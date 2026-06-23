import { generateGeminiAnswer } from '../gemini';

export async function generateHypotheticalDocument(question: string): Promise<string> {
  const prompt = [
    'You are a HyDE (Hypothetical Document Embedding) generator.',
    'Given a user question, write a detailed, well-structured hypothetical document',
    'that would be the ideal answer to the question. Include technical details,',
    'explanations, examples, and key terminology that would appear in a real document',
    'about this topic.',
    '',
    'The goal is to create a rich semantic representation for vector search,',
    'so include as much relevant context and domain language as possible.',
    '',
    `Question: ${question}`,
    '',
    'Hypothetical document:'
  ].join('\n');

  return (await generateGeminiAnswer(prompt)) || question;
}
