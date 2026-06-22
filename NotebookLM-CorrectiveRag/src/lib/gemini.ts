import { GoogleGenAI } from '@google/genai';
import { env } from './env';

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
  }

  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

export function getGeminiEmbeddingPrompt(text: string, title = 'none') {
  return `title: ${title} | text: ${text}`;
}

async function embedContent(content: string): Promise<number[]> {
  const client = getGeminiClient();
  const result = await client.models.embedContent({
    model: env.GEMINI_EMBEDDING_MODEL,
    contents: content,
    config: {
      outputDimensionality: env.GEMINI_EMBEDDING_DIMENSIONS
    }
  });

  return result.embeddings?.[0]?.values ?? [];
}

export async function createQueryEmbedding(input: string): Promise<number[]> {
  return embedContent(`task: question answering | query: ${input}`);
}

export async function createDocumentEmbedding(input: string, title = 'none'): Promise<number[]> {
  return embedContent(`title: ${title} | text: ${input}`);
}

export async function generateGeminiAnswer(prompt: string) {
  const client = getGeminiClient();
  const result = await client.models.generateContent({
    model: env.GEMINI_CHAT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.2
    }
  });

  return result.text?.trim() || 'I could not generate an answer.';
}