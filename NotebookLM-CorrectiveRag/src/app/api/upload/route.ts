import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { chunkText } from '@/lib/rag/chunk';
import { extractTextFromFile } from '@/lib/rag/parse';
import { getSupabaseClient } from '@/lib/supabase';
import { createDocumentEmbedding } from '@/lib/gemini';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const requestBuckets = new Map<string, number[]>();

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const candidate = forwardedFor?.split(',')[0]?.trim() || realIp || 'local';

  return candidate;
}

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const windowMs = env.UPLOAD_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const maxRequests = env.UPLOAD_RATE_LIMIT_MAX_REQUESTS;
  const recentRequests = (requestBuckets.get(clientKey) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    requestBuckets.set(clientKey, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestBuckets.set(clientKey, recentRequests);
  return false;
}

export async function POST(request: Request) {
  try {
    const clientKey = getClientKey(request);

    if (isRateLimited(clientKey)) {
      return NextResponse.json({ error: 'Too many uploads. Please wait before trying again.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    }

    const maxUploadBytes = env.UPLOAD_MAX_FILE_MB * 1024 * 1024;

    if (file.size > maxUploadBytes) {
      return NextResponse.json(
        { error: `File too large. Maximum upload size is ${env.UPLOAD_MAX_FILE_MB} MB.` },
        { status: 413 }
      );
    }

    const documentId = randomUUID();
    const fileName = file.name;
    const text = await extractTextFromFile(file);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'The uploaded file did not contain readable text' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const chunkRows = [] as Array<Record<string, unknown>>;

    for (const chunk of chunks) {
      const embedding = await createDocumentEmbedding(chunk.content, fileName);
      chunkRows.push({
        document_id: documentId,
        file_name: fileName,
        content: chunk.content,
        chunk_index: chunk.chunkIndex,
        embedding
      });
    }

    const { error } = await supabase.from('document_chunks').insert(chunkRows);

    if (error) {
      if (error.code === '42P01' || /document_chunks|schema cache/i.test(error.message)) {
        throw new Error(
          'Supabase is missing the public.document_chunks table. Run supabase/schema.sql in the Supabase SQL editor, then retry.'
        );
      }

      throw new Error(error.message);
    }

    return NextResponse.json({
      documentId,
      fileName,
      chunkCount: chunks.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}