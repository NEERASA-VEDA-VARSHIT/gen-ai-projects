import type { Step, ActionResult, ElementTarget } from '@/types/agent';
import type { Planner } from './planner';
import { ActionRunner } from '@/browser/action-runner';
import { BrowserManager } from '@/browser/browser-manager';
import { PageAnalyzer } from '@/browser/page-analyzer';
import { Logger } from '@/logger/logger';
import { env } from '@/config/env';
import { AgentMemory } from './memory';

export class Executor {
  private runner!: ActionRunner;
  private analyzer: PageAnalyzer;

  constructor(
    private browserManager: BrowserManager,
    private memory: AgentMemory,
    private planner?: Planner
  ) {
    this.analyzer = new PageAnalyzer();
  }

  async run(steps: Step[]): Promise<void> {
    Logger.separator();
    Logger.info(`Starting execution of ${steps.length} steps...`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      Logger.info(`[${i + 1}/${steps.length}] ${step.description}`);

      const result = await this.executeWithRetry(step, i);

      if (!result.success) {
        Logger.error(`Step ${i + 1} failed after retry: ${result.error}`);
        this.memory.addError(`Step ${i + 1} (${step.action}): ${result.error}`);
        await this.captureErrorScreenshot();

        const recovered = await this.tryRecovery(step, i);
        if (!recovered) {
          this.memory.setStatus('failed');
          return;
        }
        Logger.success(`Recovered from step ${i + 1} failure`);
        this.memory.addCompletedAction(`${step.action}: ${step.description} (recovered)`);
        continue;
      }

      this.memory.addCompletedAction(`${step.action}: ${step.description}`);
    }

    this.memory.setStatus('completed');
    Logger.separator();
    Logger.success('All steps executed successfully');
  }

  private async tryRecovery(failedStep: Step, index: number): Promise<boolean> {
    Logger.info('Attempting recovery from step failure...');

    if (this.planner && this.memory.getState().pageAnalysis) {
      try {
        const recoveryTask = `Recover from failed step: ${failedStep.description}. Error context: ${this.memory.getState().errors[this.memory.getState().errors.length - 1]}`;
        const recoveryPlan = await this.planner.generateRecoveryPlan(
          recoveryTask,
          this.memory.getState().pageAnalysis!,
          failedStep
        );

        if (recoveryPlan.steps.length > 0) {
          Logger.info(`Executing ${recoveryPlan.steps.length} recovery steps...`);
          for (const recoveryStep of recoveryPlan.steps) {
            const r = await this.executeWithRetry(recoveryStep, index);
            if (!r.success) {
              Logger.warn(`Recovery step failed: ${r.error}`);
              return false;
            }
            this.memory.addCompletedAction(`[recovery] ${recoveryStep.description}`);
          }
          return true;
        }
      } catch (error) {
        Logger.warn(`Recovery planning failed: ${String(error)}`);
      }
    }

    const fallbackStep = this.generateFallbackStep(failedStep);
    if (fallbackStep) {
      Logger.info('Trying fallback coordinate-based approach...');
      const result = await this.executeWithRetry(fallbackStep, index);
      return result.success;
    }

    return false;
  }

  private generateFallbackStep(failedStep: Step): Step | null {
    const analysis = this.memory.getState().pageAnalysis;
    if (!analysis) return null;

    const params = failedStep.params || {};
    const targetLabel = (params.target as ElementTarget) || {};
    const coords = targetLabel.coordinates;

    if (coords) {
      return {
        action: 'click_on_screen',
        params: { x: coords.x, y: coords.y },
        description: `Fallback coordinate click at (${coords.x}, ${coords.y})`,
      };
    }

    const allElements = [...analysis.inputs, ...analysis.textareas, ...analysis.buttons];
    if (allElements.length > 0) {
      const el = allElements[0];
      return {
        action: 'click_on_screen',
        params: { x: el.rect.centerX, y: el.rect.centerY },
        description: `Fallback click on ${el.tag} at (${el.rect.centerX}, ${el.rect.centerY})`,
      };
    }

    return null;
  }

  private async executeWithRetry(step: Step, index: number): Promise<ActionResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt === 1) {
          Logger.info(`Retrying step ${index + 1}...`);
        }
        const result = await this.executeStep(step);
        if (!result.success) throw new Error(result.error || 'Action failed');
        return result;
      } catch (error) {
        const msg = String(error);
        Logger.warn(`Attempt ${attempt + 1} failed: ${msg}`);
        if (attempt === 0) {
          await this.captureErrorScreenshot();
        }
      }
    }
    return { success: false, error: `Failed after 2 attempts` };
  }

  private async executeStep(step: Step): Promise<ActionResult> {
    const params = step.params || {};

    switch (step.action) {
      case 'open_browser': {
        await this.browserManager.init(env.HEADLESS);
        this.runner = new ActionRunner(this.browserManager.getPage());
        return { success: true };
      }

      case 'navigate_to_url': {
        if (!this.browserManager.isInitialized()) {
          await this.browserManager.init(env.HEADLESS);
          this.runner = new ActionRunner(this.browserManager.getPage());
        }
        return this.runner.navigate(params.url as string);
      }

      case 'analyze_page': {
        const page = this.browserManager.getPage();
        const analysis = await this.analyzer.analyze(page);
        this.memory.setPageAnalysis(analysis);
        this.memory.setUrl(page.url());
        return { success: true, data: analysis };
      }

      case 'take_screenshot': {
        const result = await this.runner.screenshot(params.name as string);
        if (result.success) {
          this.memory.addScreenshot(params.name as string);
        }
        return result;
      }

      case 'click_on_screen':
        return this.runner.click(params.x as number, params.y as number);

      case 'click_element':
        return this.runner.clickElement(params.target as ElementTarget);

      case 'focus_element':
        return this.runner.focusElement(params.target as ElementTarget);

      case 'double_click':
        return this.runner.doubleClick(params.x as number, params.y as number);

      case 'send_keys':
        return this.runner.type(params.text as string);

      case 'press_enter':
        return this.runner.pressEnter();

      case 'scroll':
        return this.runner.scroll(params.amount as number);

      case 'reanalyze_page': {
        const page = this.browserManager.getPage();
        await page.waitForTimeout(500);
        const analysis = await this.analyzer.analyze(page);
        this.memory.setPageAnalysis(analysis);
        this.memory.setUrl(page.url());
        return { success: true, data: analysis };
      }

      case 'verify_fill': {
        const page = this.browserManager.getPage();
        const expectedValues = Array.isArray(params.expectedValues)
          ? params.expectedValues.filter((value): value is string => typeof value === 'string')
          : [];
        const values = await page.locator('input, textarea').evaluateAll(
          (elements: Element[]) =>
            elements.map((element) => (element as HTMLInputElement).value)
        );
        const nonEmptyCount = values.filter(Boolean).length;
        Logger.info(`Non-empty field values after fill: ${nonEmptyCount} field(s)`);
        const missing = expectedValues.filter((expected) => !values.includes(expected));
        if (expectedValues.length === 0 || missing.length > 0) {
          return {
            success: false,
            error: expectedValues.length === 0
              ? 'Verification requires expectedValues'
              : `Expected ${expectedValues.length} value(s), ${missing.length} missing`,
          };
        }
        return { success: true, data: { filled: nonEmptyCount } };
      }

      default:
        return { success: false, error: `Unknown action type: ${step.action}` };
    }
  }

  private async captureErrorScreenshot(): Promise<void> {
    try {
      if (this.browserManager.isInitialized()) {
        const page = this.browserManager.getPage();
        await page.screenshot({ path: 'screenshots/error.png' });
        Logger.info('Saved error screenshot');
      }
    } catch {
      // Swallow — screenshot may fail if browser is already closed
    }
  }
}
