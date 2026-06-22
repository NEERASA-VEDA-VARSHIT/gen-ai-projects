import { generateGeminiAnswer } from '../gemini';

export async function rewriteQuery(question: string): Promise<string> {
  const prompt = [
    'You are a query rewriting assistant. Rewrite the user question to be more',
    'effective for semantic search. Expand acronyms, clarify ambiguous terms,',
    'and improve searchability while preserving the original intent.',
    '',
    'Return ONLY the rewritten query, nothing else.',
    '',
    `Original question: ${question}`,
    '',
    'Rewritten query:'
  ].join('\n');

  const rewritten = await generateGeminiAnswer(prompt);
  const cleaned = rewritten.trim();
  return cleaned || question;
}

export async function expandQueries(question: string): Promise<string[]> {
  const prompt = [
    'You are a query expansion assistant. Given a user question, generate 3 different',
    'versions that capture distinct aspects or phrasings of the question.',
    'Each should be self-contained, concise, and optimized for semantic search.',
    '',
    'Return a JSON array of strings, e.g. ["query1", "query2", "query3"]',
    '',
    `Original question: ${question}`,
    '',
    'JSON:'
  ].join('\n');

  const response = await generateGeminiAnswer(prompt);
  try {
    const cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
    const queries = JSON.parse(cleaned);
    return Array.isArray(queries) ? queries.slice(0, 3) : [question];
  } catch {
    return [question];
  }
}
