create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  file_name text not null,
  content text not null,
  chunk_index integer not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_document_id uuid,
  match_threshold double precision default 0.2,
  match_count integer default 5
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  content text,
  chunk_index integer,
  similarity double precision
)
language sql
stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.file_name,
    document_chunks.content,
    document_chunks.chunk_index,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from public.document_chunks
  where document_chunks.document_id = match_document_id
    and 1 - (document_chunks.embedding <=> query_embedding) >= match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;