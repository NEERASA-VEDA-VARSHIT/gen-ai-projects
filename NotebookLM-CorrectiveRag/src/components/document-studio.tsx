'use client';

import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpRight, FileText, Loader2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

type UploadState = {
  documentId: string;
  fileName: string;
  chunkCount: number;
};

type RetrievedChunk = {
  content: string;
  similarity: number;
  chunk_index: number;
  file_name?: string | null;
};

export function DocumentStudio() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<RetrievedChunk[]>([]);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    setError('');
    setSelectedFile(acceptedFiles[0] ?? null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    }
  });

  const canAsk = useMemo(() => Boolean(uploadState?.documentId && question.trim()), [question, uploadState]);

  async function handleUpload() {
    if (!selectedFile) {
      setError('Choose a PDF or TXT file first.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Upload failed');
      }

      setUploadState(data);
      setAnswer('');
      setSources([]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAsk() {
    if (!uploadState?.documentId) {
      setError('Upload a document before asking questions.');
      return;
    }

    if (!question.trim()) {
      setError('Enter a question.');
      return;
    }

    setIsAsking(true);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: uploadState.documentId,
          question
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Chat failed');
      }

      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Chat failed');
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Ingest document</h2>
            <p className="mt-1 text-sm text-slate-400">Parse, chunk, embed, and store the file in Supabase.</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            Recursive chunking: 800 / 150
          </div>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center transition',
            isDragActive ? 'bg-emerald-400/10 border-emerald-300/40' : 'bg-white/[0.03] hover:bg-white/[0.05]'
          )}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-10 w-10 text-emerald-300" />
          <p className="mt-4 text-base font-medium text-white">Drop PDF or TXT here</p>
          <p className="mt-2 text-sm text-slate-400">or click to browse files locally.</p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <FileText className="h-4 w-4 text-cyan-300" />
            <span>{selectedFile ? selectedFile.name : 'No file selected yet'}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              {isUploading ? 'Uploading' : 'Upload and index'}
            </button>
            {uploadState ? (
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
                Indexed {uploadState.chunkCount} chunks
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
          <p className="font-medium text-white">Upload details</p>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Document ID</dt>
              <dd className="font-mono text-xs text-slate-200">{uploadState?.documentId ?? 'Pending'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">File</dt>
              <dd>{uploadState?.fileName ?? selectedFile?.name ?? 'None'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Chunk strategy</dt>
              <dd>Recursive character split</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <h2 className="text-lg font-semibold text-white">Ask grounded questions</h2>
        <p className="mt-1 text-sm text-slate-400">The answer is generated from the top retrieved chunks only.</p>

        <div className="mt-5 space-y-4">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={5}
            placeholder="Ask something like: What is the revenue growth?"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={!canAsk || isAsking}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {isAsking ? 'Generating' : 'Ask document'}
          </button>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Answer</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">
            {answer || 'Your grounded answer will appear here after retrieval.'}
          </p>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Retrieved chunks</p>
          <div className="mt-3 space-y-3">
            {sources.length ? (
              sources.map((source) => (
                <article key={`${source.chunk_index}-${source.similarity}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                    <span>Chunk {source.chunk_index}</span>
                    <span>Similarity {(source.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-200">{source.content}</p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                Retrieved chunks will be shown here so the retrieval step is visible during the demo.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}