import { DocumentStudio } from '@/components/document-studio';

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid-pattern pointer-events-none absolute inset-0 opacity-20 [background-size:48px_48px]" />
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur-xl sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-sky-400/10" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium tracking-[0.22em] text-emerald-200 uppercase">
              NotebookLM RAG
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Upload documents, retrieve evidence, and answer with grounded context.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                This app demonstrates a minimal but properly layered retrieval-augmented generation pipeline with PDF parsing, recursive chunking, embeddings, pgvector similarity search, and source-backed answers.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">Demo flow</p>
            <ol className="mt-3 space-y-2">
              <li>1. Upload a PDF or TXT file.</li>
              <li>2. Store chunk embeddings in Supabase.</li>
              <li>3. Ask a question and inspect the retrieved chunks.</li>
            </ol>
          </div>
        </div>
      </section>
      <section className="relative z-10 mt-6 flex-1">
        <DocumentStudio />
      </section>
    </main>
  );
}