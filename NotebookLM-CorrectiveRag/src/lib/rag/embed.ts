import { createQueryEmbedding } from '../gemini';

export async function createEmbedding(input: string): Promise<number[]> {
  return createQueryEmbedding(input);
}