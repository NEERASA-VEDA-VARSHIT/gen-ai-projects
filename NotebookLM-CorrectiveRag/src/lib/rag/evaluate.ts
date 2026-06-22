import { generateGeminiAnswer } from '../gemini';
import type { RetrievedChunk } from './prompt';

export type RetrievalVerdict = 'sufficient' | 'insufficient';

export async function evaluateRetrieval(
  question: string,
  chunks: RetrievedChunk[]
): Promise<{ verdict: RetrievalVerdict; reason: string }> {
  if (chunks.length === 0) {
    return { verdict: 'insufficient', reason: 'No chunks retrieved.' };
  }

  const context = chunks
    .map((c, i) => `[${i + 1}] (sim: ${c.similarity.toFixed(3)}): ${c.content.slice(0, 300)}`)
    .join('\n\n');

  const prompt = [
    'You are a retrieval quality evaluator.',
    'Determine whether the retrieved context is SUFFICIENT or INSUFFICIENT to answer the question.',
    '',
    'Consider:',
    '- Does the context contain information directly relevant to the question?',
    '- Is there enough detail to produce a factual answer?',
    '- If the context is only vaguely related or lacks key specifics, it is INSUFFICIENT.',
    '',
    `Question: ${question}`,
    '',
    `Retrieved Context:\n${context}`,
    '',
    'Respond with exactly one line: SUFFICIENT or INSUFFICIENT',
    'Then on the next line, a brief reason.'
  ].join('\n');

  const response = await generateGeminiAnswer(prompt);

  const verdict: RetrievalVerdict = response.startsWith('SUFFICIENT')
    ? 'sufficient'
    : 'insufficient';

  const reason = response.replace(/^SUFFICIENT|^INSUFFICIENT/, '').trim();

  return { verdict, reason };
}

export function evaluateBySimilarity(
  chunks: RetrievedChunk[],
  threshold = 0.55
): RetrievalVerdict {
  if (chunks.length === 0) return 'insufficient';
  const avgSimilarity =
    chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;
  return avgSimilarity >= threshold ? 'sufficient' : 'insufficient';
}
