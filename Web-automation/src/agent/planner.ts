import type { Step, PlanResult, PageAnalysis, ElementTarget, PageElement } from '@/types/agent';
import type { LLMProvider } from '@/llm/types';
import { Logger } from '@/logger/logger';

export class Planner {
  constructor(private llm: LLMProvider | null) {}

  async generatePlan(task: string, analysis: PageAnalysis): Promise<PlanResult> {
    Logger.info('Generating field-filling plan from page analysis...');

    if (this.llm) {
      try {
        return await this.planWithLLM(task, analysis);
      } catch (error) {
        Logger.warn(`LLM planning failed, using heuristic fallback: ${String(error)}`);
      }
    }

    return this.planWithHeuristics(task, analysis);
  }

  async generateRecoveryPlan(
    task: string,
    analysis: PageAnalysis,
    failedStep: Step
  ): Promise<PlanResult> {
    Logger.info('Generating recovery plan...');

    if (this.llm) {
      try {
        return await this.planRecoveryWithLLM(task, analysis, failedStep);
      } catch (error) {
        Logger.warn(`LLM recovery planning failed: ${String(error)}`);
      }
    }

    return this.planRecoveryWithHeuristics(analysis, failedStep);
  }

  private async planRecoveryWithLLM(
    task: string,
    analysis: PageAnalysis,
    failedStep: Step
  ): Promise<PlanResult> {
    const allFields = this.serializeFields(analysis);

    const prompt = `You are a browser automation agent recovering from a failed step.

Page URL: ${analysis.url}
Page Title: ${analysis.title}

Recovery Task: ${task}

Failed Step: ${JSON.stringify(failedStep)}

Detected form fields:
${JSON.stringify(allFields, null, 2)}

Detected Labels:
${JSON.stringify(analysis.labels, null, 2)}

The previous approach failed. Try a different strategy:
1. Use click_element with a different target property (try label instead of selector, or placeholder instead of label)
2. Consider using a broader selector or different text matching
3. If the page may have changed, use reanalyze_page first
4. As last resort, use click_on_screen with coordinates

Available actions: click_element, focus_element, send_keys, press_enter, click_on_screen, reanalyze_page, take_screenshot, scroll.

For click_element, use:
{ "action": "click_element", "params": { "target": { "selector": "#id", "label": "Email", "placeholder": "Enter email" } }, "description": "Click email field" }

Respond with a valid JSON object:
{
  "reasoning": "Explain the recovery approach",
  "steps": [ ... ]
}

Return ONLY valid JSON. No markdown.`;

    if (!this.llm) throw new Error('LLM not available');
    const result = await this.llm.generateJSON<PlanResult>(prompt);
    this.validatePlan(result, true);
    Logger.info(`LLM generated ${result.steps.length} recovery steps`);
    return result;
  }

  private planRecoveryWithHeuristics(
    analysis: PageAnalysis,
    failedStep: Step
  ): PlanResult {
    const steps: Step[] = [];
    const allElements = [...analysis.inputs, ...analysis.textareas, ...analysis.buttons];

    if (allElements.length === 0) {
      steps.push({
        action: 'reanalyze_page',
        description: 'Re-analyze page to get fresh element data',
      });
      return { reasoning: 'No elements found, re-analyzing page', steps };
    }

    const failedTarget = failedStep.params?.target as ElementTarget | undefined;
    const failedCoords = failedStep.params as { x?: number; y?: number } | undefined;

    if (failedTarget) {
      const targetPriority: Array<keyof ElementTarget> = ['selector', 'label', 'placeholder', 'ariaLabel', 'textContent', 'name', 'id'];

      for (const key of targetPriority) {
        if (failedTarget[key]) {
          const alternateKey = targetPriority.find((k) => k !== key && failedTarget[k]);
          if (alternateKey) {
            steps.push({
              action: 'click_element',
              params: {
                target: {
                  [alternateKey]: failedTarget[alternateKey],
                  coordinates: failedTarget.coordinates,
                },
              },
              description: `Retry click via ${alternateKey}: ${failedTarget[alternateKey]}`,
            });
            return { reasoning: `Switching to ${alternateKey} strategy`, steps };
          }
        }
      }
    }

    if (failedCoords && typeof failedCoords.x === 'number' && typeof failedCoords.y === 'number') {
      const nearby = allElements.find(
        (el) => Math.abs(el.rect.centerX - failedCoords.x!) < 100 && Math.abs(el.rect.centerY - failedCoords.y!) < 100
      );
      if (nearby) {
        steps.push({
          action: 'click_element',
          params: {
            target: {
              selector: nearby.selector,
              label: nearby.labelText || undefined,
              placeholder: nearby.placeholder || undefined,
              coordinates: { x: nearby.rect.centerX, y: nearby.rect.centerY },
            },
          },
          description: `Recovery click on ${nearby.tag}: ${nearby.labelText || nearby.placeholder || nearby.selector}`,
        });
        return { reasoning: `Found nearby element for recovery`, steps };
      }
    }

    steps.push({
      action: 'reanalyze_page',
      description: 'Re-analyze page for recovery',
    });

    return { reasoning: 'Attempting to re-analyze page', steps };
  }

  private async planWithLLM(task: string, analysis: PageAnalysis): Promise<PlanResult> {
    const allFields = this.serializeFields(analysis);

    const prompt = `You are a browser automation agent. Your goal is to execute the user's task on a web page.

Page URL: ${analysis.url}
Page Title: ${analysis.title}

User Task: ${task}

Detected form fields (inputs and textareas):
${JSON.stringify(allFields, null, 2)}

Detected Labels:
${JSON.stringify(analysis.labels, null, 2)}

Instructions:
1. Analyze the user's task to determine what text to type and which fields to type into.
2. Match fields by their label text, placeholder, aria-label, name, id, or CSS selector.
3. Generate a step-by-step plan: use click_element to focus each field, then send_keys to type text.
4. For click_element, provide a target object with identifying properties. Include the selector if available, plus label or placeholder for fallback strategies.
5. Include coordinates as a last-resort fallback for each click_element target.
6. If the task involves searching or submitting, include a press_enter step after typing.
7. End with a verify_fill step listing the text values that were typed, followed by a take_screenshot step.

Available actions: click_element, focus_element, send_keys, press_enter, take_screenshot, scroll, verify_fill.

Example click_element usage:
{ "action": "click_element", "params": { "target": { "selector": "#email", "label": "Email Address", "placeholder": "Enter your email", "coordinates": { "x": 500, "y": 300 } } }, "description": "Click on email field" }

Respond with a valid JSON object in this format:
{
  "reasoning": "Explain which fields you matched and what text you typed",
  "steps": [
    { "action": "click_element", "params": { "target": { "selector": "#field-id", "label": "Field Label", "placeholder": "Placeholder text", "coordinates": { "x": 100, "y": 200 } } }, "description": "Click on first field" },
    { "action": "send_keys", "params": { "text": "value to type" }, "description": "Type value" },
    { "action": "verify_fill", "params": { "expectedValues": ["value to type"] }, "description": "Verify fields were filled" },
    { "action": "take_screenshot", "params": { "name": "after-fill" }, "description": "Take final screenshot" }
  ]
}

Return ONLY valid JSON. No markdown.`;

    if (!this.llm) throw new Error('LLM not available');
    const result = await this.llm.generateJSON<PlanResult>(prompt);
    this.validatePlan(result, false);
    Logger.info(`LLM generated ${result.steps.length} steps`);
    Logger.info(`LLM reasoning: ${result.reasoning}`);
    return result;
  }

  private serializeFields(analysis: PageAnalysis): unknown[] {
    return [...analysis.inputs, ...analysis.textareas].map((f, idx) => ({
      index: idx,
      tag: f.tag,
      type: f.type,
      placeholder: f.placeholder,
      labelText: f.labelText,
      name: f.name,
      id: f.id,
      ariaLabel: f.ariaLabel,
      textContent: f.textContent,
      selector: f.selector,
      centerX: Math.round(f.rect.centerX),
      centerY: Math.round(f.rect.centerY),
    }));
  }

  private validatePlan(plan: PlanResult, isRecovery: boolean): void {
    if (!plan || typeof plan.reasoning !== 'string' || !Array.isArray(plan.steps)) {
      throw new Error('Agent returned an invalid plan object');
    }

    for (const [index, step] of plan.steps.entries()) {
      const params = step.params || {};
      if (!step.description || typeof step.description !== 'string') {
        throw new Error(`Plan step ${index + 1} has no description`);
      }
      switch (step.action) {
        case 'click_element':
        case 'focus_element':
          if (!params.target || typeof params.target !== 'object') {
            throw new Error(`Plan step ${index + 1} has invalid target`);
          }
          break;
        case 'click_on_screen':
          if (!Number.isFinite(params.x) || !Number.isFinite(params.y)) {
            throw new Error(`Plan step ${index + 1} has invalid click coordinates`);
          }
          break;
        case 'send_keys':
          if (typeof params.text !== 'string' || params.text.length === 0) {
            throw new Error(`Plan step ${index + 1} has invalid text`);
          }
          break;
        case 'take_screenshot':
          if (typeof params.name !== 'string' || params.name.length === 0) {
            throw new Error(`Plan step ${index + 1} has invalid screenshot name`);
          }
          break;
        case 'scroll':
          if (!Number.isFinite(params.amount)) {
            throw new Error(`Plan step ${index + 1} has an invalid scroll amount`);
          }
          break;
        case 'press_enter':
        case 'reanalyze_page':
          break;
        case 'verify_fill':
          if (!Array.isArray(params.expectedValues) || params.expectedValues.length < 1) {
            throw new Error(`Plan step ${index + 1} must have at least one expected value`);
          }
          break;
        default:
          throw new Error(`Plan step ${index + 1} uses unsupported action ${step.action}`);
      }
    }

    if (!isRecovery && !plan.steps.some((step) => step.action === 'verify_fill')) {
      throw new Error('Agent plan does not verify the filled values');
    }
  }

  private extractTaskInfo(task: string): { textToType: string; targetKeywords: string[] } {
    const fullPattern = task.match(
      /^(?:please\s+)?(?:search(?:\s+for)?|find|type|enter|fill|look up|lookup|input)\s+(.+?)\s+(?:in|into|on|at)\s+(?:the\s+)?(.+)$/i
    );
    if (fullPattern) {
      const target = fullPattern[2].trim();
      return {
        textToType: fullPattern[1].trim(),
        targetKeywords: [...new Set([target, ...target.split(/\s+/)])],
      };
    }

    const verbMatch = task.match(
      /^(?:please\s+)?(?:search(?:\s+for)?|find|type|enter|fill(?:\s+in)?|look up|lookup|input)\s+(.+)$/i
    );
    if (verbMatch) {
      return { textToType: verbMatch[1].trim(), targetKeywords: [] };
    }

    return { textToType: task, targetKeywords: [] };
  }

  private buildTargetFromElement(el: PageElement): ElementTarget {
    const target: ElementTarget = {
      selector: el.selector || undefined,
      label: el.labelText || undefined,
      placeholder: el.placeholder || undefined,
      ariaLabel: el.ariaLabel || undefined,
      textContent: el.textContent || undefined,
      tag: el.tag,
      name: el.name || undefined,
      id: el.id || undefined,
      type: el.type || undefined,
      coordinates: { x: el.rect.centerX, y: el.rect.centerY },
    };
    return target;
  }

  private planWithHeuristics(task: string, analysis: PageAnalysis): PlanResult {
    const steps: Step[] = [];
    const allFields = [...analysis.inputs, ...analysis.textareas];
    const { textToType, targetKeywords } = this.extractTaskInfo(task);

    const nameKeywords = ['name', 'username', 'title', 'full name', 'first name', 'email', 'subject'];
    const descKeywords = [
      'description', 'bio', 'details', 'comments', 'message', 'about',
      'additional', 'notes', 'feedback',
    ];

    const findField = (
      keywords: string[],
      pool: typeof allFields
    ): (typeof allFields)[0] | undefined => {
      for (const kw of keywords) {
        const found = pool.find(
          (f) =>
            f.labelText?.toLowerCase().includes(kw) ||
            f.placeholder?.toLowerCase().includes(kw) ||
            f.name?.toLowerCase().includes(kw) ||
            f.id?.toLowerCase().includes(kw) ||
            f.ariaLabel?.toLowerCase().includes(kw)
        );
        if (found) return found;
      }
      return undefined;
    };

    const typedValues: string[] = [];

    const primaryKeywords = targetKeywords.length > 0 ? targetKeywords : nameKeywords;
    let primaryField = findField(primaryKeywords, analysis.inputs);

    if (primaryField) {
      Logger.success(`Heuristic: matched field via ${targetKeywords.length > 0 ? 'task' : 'name'} keywords`);
    } else if (analysis.inputs.length > 0) {
      primaryField = analysis.inputs[0];
      Logger.warn('No matching field found by heuristic; using first available input');
    }

    if (primaryField) {
      steps.push({
        action: 'click_element',
        params: { target: this.buildTargetFromElement(primaryField) },
        description: `Click on input (${primaryField.labelText || primaryField.placeholder || primaryField.selector || 'field'})`,
      });
      steps.push({
        action: 'send_keys',
        params: { text: textToType },
        description: 'Type into field',
      });
      typedValues.push(textToType);
    }

    const hasSingleTarget = targetKeywords.length > 0;
    if (!hasSingleTarget && allFields.length > 1) {
      const descField = findField(
        descKeywords,
        analysis.textareas.length > 0 ? analysis.textareas : analysis.inputs
      );
      if (descField && (!primaryField || descField.rect.centerY !== primaryField.rect.centerY)) {
        steps.push({
          action: 'click_element',
          params: { target: this.buildTargetFromElement(descField) },
          description: `Click on description field (${descField.labelText || descField.placeholder || descField.selector || 'field'})`,
        });
        steps.push({
          action: 'send_keys',
          params: { text: textToType },
          description: 'Type into description field',
        });
        typedValues.push(textToType);
        Logger.success('Heuristic: matched description field');
      }
    }

    if (typedValues.length === 0) {
      Logger.warn('No fields found to fill');
      return {
        reasoning: 'No interactive fields found on the page.',
        steps: [{
          action: 'take_screenshot',
          params: { name: 'after-fill' },
          description: 'Take screenshot (no fields found)',
        }],
      };
    }

    steps.push({
      action: 'verify_fill',
      params: { expectedValues: typedValues },
      description: 'Verify fields were populated correctly',
    });

    steps.push({
      action: 'take_screenshot',
      params: { name: 'after-fill' },
      description: 'Take screenshot after filling fields',
    });

    return {
      reasoning: `Task-based heuristic: extracted text="${textToType}"${targetKeywords.length ? `, target keywords=[${targetKeywords.join(', ')}]` : ''}, typed values=[${typedValues.join(', ')}]`,
      steps,
    };
  }
}
