import { NextResponse } from 'next/server';
import { generateGeminiAnswer } from '@/lib/gemini';
import { buildGroundedPrompt, type RetrievedChunk } from '@/lib/rag/prompt';
import { createEmbedding } from '@/lib/rag/embed';
import { rewriteQuery } from '@/lib/rag/rewrite';
import { rerankChunks } from '@/lib/rag/rerank';
import { retrieveTopChunks, retrieveWithExpansion } from '@/lib/rag/retrieve';
import { evaluateRetrieval, evaluateBySimilarity } from '@/lib/rag/evaluate';

export const runtime = 'nodejs';

async function correctRetrieval(
  question: string,
  documentId: string,
  queryEmbedding: number[]
): Promise<{ chunks: RetrievedChunk[]; corrected: boolean }> {
  const chunks = await retrieveTopChunks(documentId, queryEmbedding, { limit: 20 });

  const reranked = await rerankChunks(question, chunks);
  const top5 = reranked.slice(0, 5);

  const similarityOk = evaluateBySimilarity(top5, 0.55);

  if (similarityOk === 'sufficient') {
    const llmCheck = await evaluateRetrieval(question, top5);
    if (llmCheck.verdict === 'sufficient') {
      return { chunks: top5, corrected: false };
    }
  }

  const expanded = await retrieveWithExpansion(documentId, question, queryEmbedding);

  return { chunks: expanded, corrected: true };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = String(body.question ?? '').trim();
    const documentId = String(body.documentId ?? '').trim();

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required. Upload a document first.' }, { status: 400 });
    }

    const rewrittenQuery = await rewriteQuery(question);
    const questionEmbedding = await createEmbedding(rewrittenQuery);
    const { chunks, corrected } = await correctRetrieval(question, documentId, questionEmbedding);
    const prompt = buildGroundedPrompt(question, chunks);
    const answer = await generateGeminiAnswer(prompt);

    return NextResponse.json({
      answer,
      sources: chunks,
      corrected,
      rewrittenQuery
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}