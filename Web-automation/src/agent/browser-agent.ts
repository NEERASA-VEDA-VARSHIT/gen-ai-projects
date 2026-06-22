import { BrowserManager } from '@/browser/browser-manager';
import { PageAnalyzer } from '@/browser/page-analyzer';
import { Planner } from './planner';
import { Executor } from './executor';
import { AgentMemory } from './memory';
import { Logger } from '@/logger/logger';
import { createLLMProvider } from '@/llm/provider';
import type { Step, AgentRunResult } from '@/types/agent';

export class BrowserAgent {
  private browserManager: BrowserManager;
  private analyzer: PageAnalyzer;
  private planner: Planner;
  private executor: Executor;
  private memory: AgentMemory;

  constructor() {
    this.browserManager = new BrowserManager();
    this.analyzer = new PageAnalyzer();
    const llm = createLLMProvider();
    if (llm) {
      Logger.info(`LLM provider initialized: ${llm.constructor.name}`);
    } else {
      Logger.warn('No LLM API key found. Using heuristic-based fallback detection.');
    }
    this.planner = new Planner(llm);
    this.memory = new AgentMemory();
    this.executor = new Executor(this.browserManager, this.memory);
  }

  async run(task: string, url: string): Promise<AgentRunResult> {
    Logger.clearLog();
    Logger.separator();
    Logger.info('WEBSITE AUTOMATION AGENT');
    Logger.info(`Task: ${task}`);
    Logger.info(`Target: ${url}`);
    Logger.separator();

    this.memory.setStatus('planning');

    try {
      // Phase 1: Observe — navigate and analyze the page
      this.memory.setStatus('executing');

      const observeSteps: Step[] = [
        {
          action: 'open_browser',
          description: 'Launch browser',
        },
        {
          action: 'navigate_to_url',
          params: { url },
          description: `Navigate to ${url}`,
        },
        {
          action: 'scroll',
          params: { amount: 500 },
          description: 'Scroll down to find form content',
        },
        {
          action: 'analyze_page',
          description: 'Analyze DOM and detect form fields',
        },
        {
          action: 'take_screenshot',
          params: { name: 'before-fill' },
          description: 'Take before-fill screenshot',
        },
      ];

      Logger.info('Phase 1: Observe — navigating and analyzing page');
      await this.executor.run(observeSteps);

      if (this.memory.getState().status === 'failed') {
        return this.memory.getRunResult();
      }

      // Phase 2: Analyze — review page analysis
      const analysis = this.memory.getState().pageAnalysis;
      if (!analysis) {
        Logger.error('Page analysis returned no data');
        this.memory.setStatus('failed');
        this.memory.addError('Page analysis returned null');
        return this.memory.getRunResult();
      }

      Logger.info(`Page title: "${analysis.title}"`);
      Logger.info(`Found ${analysis.inputs.length} input(s), ${analysis.textareas.length} textarea(s)`);

      // Phase 3 & 4: Plan & Execute — generate and run fill steps
      Logger.separator();
      Logger.info('Phase 2-3: Analyze & Plan — identifying target fields');
      const plan = await this.planner.generatePlan(task, analysis);
      Logger.info(`Planning reasoning: ${plan.reasoning}`);

      if (plan.steps.length === 0) {
        Logger.error('Planner generated zero steps');
        this.memory.setStatus('failed');
        this.memory.addError('Empty plan from planner');
        return this.memory.getRunResult();
      }

      Logger.info(`Phase 4: Execute — running ${plan.steps.length} fill steps`);
      await this.executor.run(plan.steps);

      // Phase 5: Verify
      const state = this.memory.getState();
      Logger.separator();
      if (state.status === 'completed') {
        Logger.success('AGENT MISSION COMPLETED');
      } else {
        Logger.warn('Agent finished with issues');
      }
      Logger.info(this.memory.getSummary());

      return this.memory.getRunResult();
    } catch (error) {
      const msg = String(error);
      Logger.error(`Agent crashed: ${msg}`);
      this.memory.setStatus('failed');
      this.memory.addError(`Fatal crash: ${msg}`);
      return this.memory.getRunResult();
    } finally {
      await this.browserManager.close();
    }
  }
}
