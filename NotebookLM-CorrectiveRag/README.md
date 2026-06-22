# NotebookLM RAG

A minimal but properly layered Retrieval-Augmented Generation app built with Next.js, TypeScript, Tailwind CSS, Supabase pgvector, and Gemini embeddings.

## Problem Statement

Users upload a PDF or TXT document, the system chunks and embeds the content, stores vectors in Supabase, and answers questions using only the retrieved document context.

## Architecture

```text
User Uploads PDF/TXT
        ↓
PDF/TXT Parsing
        ↓
Chunking
        ↓
Embedding Generation
        ↓
Store in Supabase pgvector
        ↓
User Question
        ↓
Question Embedding
        ↓
Similarity Search
        ↓
Top Relevant Chunks
        ↓
Grounded Prompt
        ↓
LLM Answer
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase + pgvector
- Gemini embeddings and chat generation
- react-dropzone for uploads
- pdf-parse for PDF extraction

## Chunking Strategy

The app uses recursive character chunking with:

- chunk size: 800 characters
- overlap: 150 characters

Why this matters:

- Recursive splitting preserves paragraph and sentence structure better than a fixed raw split.
- Overlap reduces context loss between adjacent chunks.
- Smaller chunks improve retrieval precision and keep prompt size manageable.

## Retrieval Flow

1. Upload a file.
2. Extract text from the document.
3. Split the text into chunks.
4. Create embeddings for each chunk.
5. Store the chunks in Supabase pgvector.
6. Embed the question.
7. Run similarity search against `document_chunks`.
8. Send the top chunks into a grounded prompt.
9. Return the answer with the retrieved chunks visible in the UI.

## Supabase Schema

The schema used by the app is in `supabase/schema.sql`.

Key table:

- `document_chunks`

Important columns:

- `document_id`
- `file_name`
- `content`
- `chunk_index`
- `embedding`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

- `GEMINI_API_KEY`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_CHAT_MODEL`
- `GEMINI_EMBEDDING_DIMENSIONS`
- `UPLOAD_MAX_FILE_MB`
- `UPLOAD_RATE_LIMIT_MAX_REQUESTS`
- `UPLOAD_RATE_LIMIT_WINDOW_SECONDS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deployment

- Frontend and API: Vercel
- Database: Supabase

## Limitations

- OCR is not implemented.
- Large PDFs may increase ingestion latency.
- Uploads are capped at 10 MB by default and rate-limited to 5 requests per minute per client.
- Citations are chunk-based rather than page-perfect unless you extend the parser.

## Viva Notes

If asked how this differs from ChatGPT, the key answer is:

- Normal LLMs rely on pretrained knowledge.
- RAG retrieves external knowledge dynamically from uploaded documents and grounds generation in retrieved context.

If asked why vector databases matter, the answer is:

- Embeddings encode semantic meaning as vectors.
- Vector databases make similarity search fast enough to retrieve the most relevant chunks for prompting.
