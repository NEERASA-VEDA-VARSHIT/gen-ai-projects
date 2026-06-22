import { Agent, OpenAIProvider, run, setTracingDisabled } from '@openai/agents';
import type { LLMProvider } from './types';

// This project uses Groq inference and intentionally has no OpenAI trace-export key.
setTracingDisabled(true);

/** OpenAI Agents SDK orchestration backed by Groq's compatible API. */
export class GroqAgentsProvider implements LLMProvider {
  private readonly provider: OpenAIProvider;

  constructor(apiKey: string, private readonly modelName: string, baseURL: string) {
    this.provider = new OpenAIProvider({ apiKey, baseURL, useResponses: false });
  }

  async generateContent(prompt: string): Promise<string> {
    const model = await this.provider.getModel(this.modelName);
    const agent = new Agent({
      name: 'Assistant',
      instructions: 'Answer the user request accurately and concisely.',
      model,
    });
    const result = await run(agent, prompt);
    return result.finalOutput || '';
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    const model = await this.provider.getModel(this.modelName);
    const agent = new Agent({
      name: 'Browser Planning Agent',
      instructions: 'You must respond with valid JSON only. No markdown, no code fences, no explanation.',
      model,
    });
    const result = await run(agent, prompt);
    const text = result.finalOutput || '{}';
    const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
