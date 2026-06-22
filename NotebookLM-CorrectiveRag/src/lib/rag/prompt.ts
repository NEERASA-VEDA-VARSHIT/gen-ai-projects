export type RetrievedChunk = {
  content: string;
  similarity: number;
  chunk_index: number;
  file_name?: string | null;
};

export function buildGroundedPrompt(question: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map((chunk, index) => `Source ${index + 1} (chunk ${chunk.chunk_index}${chunk.file_name ? `, ${chunk.file_name}` : ''}, similarity ${chunk.similarity.toFixed(2)}):\n${chunk.content}`)
    .join('\n\n');

  return [
    'You are a document assistant.',
    'Answer ONLY from the provided context.',
    'If the answer is not present in the document, say: "I could not find this information in the document."',
    'Keep the answer concise, factual, and grounded.',
    '',
    `Context:\n${context || 'No context available.'}`,
    '',
    `Question: ${question}`
  ].join('\n');
}