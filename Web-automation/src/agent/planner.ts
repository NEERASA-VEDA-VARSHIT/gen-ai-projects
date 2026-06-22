import type { Step, PlanResult, PageAnalysis } from '@/types/agent';
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

  private async planWithLLM(task: string, analysis: PageAnalysis): Promise<PlanResult> {
    const allFields = [...analysis.inputs, ...analysis.textareas].map((f, idx) => ({
      index: idx,
      tag: f.tag,
      type: f.type,
      placeholder: f.placeholder,
      labelText: f.labelText,
      name: f.name,
      id: f.id,
      ariaLabel: f.ariaLabel,
      centerX: Math.round(f.rect.centerX),
      centerY: Math.round(f.rect.centerY),
    }));

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
2. Match fields by their label text, placeholder, aria-label, name, or id attributes.
3. Generate a step-by-step plan: click to focus each field, then type the appropriate text.
4. Use the exact centerX and centerY coordinates from the detected elements for click_on_screen actions.
5. If the task involves searching or submitting, include a press_enter step after typing.
6. End with a verify_fill step listing the text values that were typed, followed by a take_screenshot step.

Available actions: click_on_screen, send_keys, press_enter, take_screenshot, scroll, verify_fill.

Respond with a valid JSON object in this format:
{
  "reasoning": "Explain which fields you matched, what text you are typing, and why",
  "steps": [
    { "action": "click_on_screen", "params": { "x": 100, "y": 200 }, "description": "Click on first field" },
    { "action": "send_keys", "params": { "text": "value to type" }, "description": "Type value" },
    { "action": "verify_fill", "params": { "expectedValues": ["value to type"] }, "description": "Verify fields were filled" },
    { "action": "take_screenshot", "params": { "name": "after-fill" }, "description": "Take final screenshot" }
  ]
}

Return ONLY valid JSON. No markdown.`;

    if (!this.llm) throw new Error('LLM not available');
    const result = await this.llm.generateJSON<PlanResult>(prompt);
    this.validatePlan(result);
    Logger.info(`LLM generated ${result.steps.length} steps`);
    Logger.info(`LLM reasoning: ${result.reasoning}`);
    return result;
  }

  private validatePlan(plan: PlanResult): void {
    if (!plan || typeof plan.reasoning !== 'string' || !Array.isArray(plan.steps)) {
      throw new Error('Agent returned an invalid plan object');
    }

    for (const [index, step] of plan.steps.entries()) {
      const params = step.params || {};
      if (!step.description || typeof step.description !== 'string') {
        throw new Error(`Plan step ${index + 1} has no description`);
      }
      if (step.action === 'click_on_screen') {
        if (!Number.isFinite(params.x) || !Number.isFinite(params.y)) {
          throw new Error(`Plan step ${index + 1} has invalid click coordinates`);
        }
      } else if (step.action === 'send_keys') {
        if (typeof params.text !== 'string' || params.text.length === 0) {
          throw new Error(`Plan step ${index + 1} has invalid text`);
        }
      } else if (step.action === 'take_screenshot') {
        if (typeof params.name !== 'string' || params.name.length === 0) {
          throw new Error(`Plan step ${index + 1} has invalid screenshot name`);
        }
      } else if (step.action === 'scroll') {
        if (!Number.isFinite(params.amount)) {
          throw new Error(`Plan step ${index + 1} has an invalid scroll amount`);
        }
      } else if (step.action === 'press_enter') {
        // press_enter takes no params
      } else if (step.action === 'verify_fill') {
        if (!Array.isArray(params.expectedValues) || params.expectedValues.length < 1) {
          throw new Error(`Plan step ${index + 1} must have at least one expected value`);
        }
      } else {
        throw new Error(`Plan step ${index + 1} uses unsupported action ${step.action}`);
      }
    }

    if (!plan.steps.some((step) => step.action === 'verify_fill')) {
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
        action: 'click_on_screen',
        params: { x: primaryField.rect.centerX, y: primaryField.rect.centerY },
        description: `Click on input (${primaryField.labelText || primaryField.placeholder || 'field'})`,
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
          action: 'click_on_screen',
          params: { x: descField.rect.centerX, y: descField.rect.centerY },
          description: `Click on description field (${descField.labelText || descField.placeholder || 'field'})`,
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
