import { getSupabaseClient } from '../supabase';
import type { RetrievedChunk } from './prompt';

type RetrieveOptions = {
  limit?: number;
  threshold?: number;
};

export async function retrieveTopChunks(
  documentId: string,
  queryEmbedding: number[],
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { limit = 5, threshold = 0.2 } = options;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryEmbedding,
    match_document_id: documentId,
    match_threshold: threshold,
    match_count: limit
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RetrievedChunk[];
}

export async function retrieveWithExpansion(
  documentId: string,
  originalEmbedding: number[]
): Promise<RetrievedChunk[]> {
  const [moreChunks, reformulatedChunks] = await Promise.all([
    retrieveTopChunks(documentId, originalEmbedding, { limit: 20, threshold: 0.1 }),
    retrieveReformulated(documentId, originalEmbedding),
  ]);

  const seen = new Set<number>();
  const merged = [...moreChunks, ...reformulatedChunks].filter((chunk) => {
    if (seen.has(chunk.chunk_index)) return false;
    seen.add(chunk.chunk_index);
    return true;
  });

  return merged.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
}

async function retrieveReformulated(
  documentId: string,
  originalEmbedding: number[]
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: originalEmbedding,
    match_document_id: documentId,
    match_threshold: 0.1,
    match_count: 10
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RetrievedChunk[];
}