import { generateGeminiAnswer } from '../gemini';
import type { RetrievedChunk } from './prompt';

export async function rerankChunks(
  question: string,
  chunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  if (chunks.length <= 1) return chunks;

  const items = chunks
    .map((c, i) => `[${i}] ${c.content.slice(0, 500)}`)
    .join('\n\n');

  const prompt = [
    'You are a relevance re-ranker. Given a question and numbered text chunks,',
    'rate how relevant each chunk is to answering the question on a scale of 0.0 to 1.0.',
    'Be strict: only high relevance deserves a score above 0.7.',
    '',
    `Question: ${question}`,
    '',
    `Chunks:\n${items}`,
    '',
    'Return ONLY a JSON array of scores in the same order as the chunks, e.g. [0.1, 0.9, 0.3]',
    '',
    'JSON:'
  ].join('\n');

  const response = await generateGeminiAnswer(prompt);
  try {
    const cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
    const scores: number[] = JSON.parse(cleaned);
    if (Array.isArray(scores) && scores.length === chunks.length) {
      const normalized = scores.map(s => Math.max(0, Math.min(1, Number(s))));
      return chunks
        .map((chunk, i) => ({ ...chunk, similarity: normalized[i] }))
        .sort((a, b) => b.similarity - a.similarity);
    }
  } catch {}

  return chunks;
}
