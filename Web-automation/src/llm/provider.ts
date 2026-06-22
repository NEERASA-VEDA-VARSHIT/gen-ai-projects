import { env } from '@/config/env';
import { GroqAgentsProvider } from './openai';
import type { LLMProvider } from './types';

export function createLLMProvider(): LLMProvider | null {
  if (!env.GROQ_API_KEY) return null;
  return new GroqAgentsProvider(env.GROQ_API_KEY, env.GROQ_MODEL, env.GROQ_BASE_URL);
}
