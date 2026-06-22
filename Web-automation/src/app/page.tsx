'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  text: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

interface AgentResult {
  success: boolean;
  summary: string;
  status: string;
  screenshots: string[];
  errors: string[];
  completedActions: number;
}

function parseLogLevel(text: string): LogEntry['level'] {
  if (text.includes('[ERROR]')) return 'error';
  if (text.includes('[WARN]')) return 'warn';
  if (text.includes('[SUCCESS]')) return 'success';
  return 'info';
}

const levelColors: Record<LogEntry['level'], string> = {
  info: 'text-cyan-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

export default function Home() {
  const [task, setTask] = useState('Find the Name and Description form fields on the page and fill them with test values.');
  const [url, setUrl] = useState('https://ui.shadcn.com/docs/forms/react-hook-form');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  async function runAgent() {
    setRunning(true);
    setLogs([]);
    setResult(null);

    try {
      const res = await fetch('/api/run-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, url }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'log') {
              setLogs((prev) => [
                ...prev,
                { text: data.message, level: data.level },
              ]);
            } else if (data.type === 'result') {
              setResult(data.payload as AgentResult);
            }
          }
        }
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        { text: `Connection error: ${String(err)}`, level: 'error' },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold text-white">Website Automation Agent</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Intelligent browser automation with LLM-based form detection
        </p>
      </header>

      <div className="mb-8 grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-300">Task</label>
          <input
            className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-700 focus:ring-cyan-500"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe what the agent should do..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-300">URL</label>
          <input
            className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-700 focus:ring-cyan-500"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Target URL..."
          />
        </div>
        <button
          onClick={runAgent}
          disabled={running}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Agent'}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-500">
            Agent Logs
          </div>
          <div className="h-80 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
            {logs.map((log, i) => (
              <div key={i} className={levelColors[log.level]}>
                {log.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {result && (
        <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Result</h2>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded bg-zinc-800 p-3 text-center">
              <div className="text-2xl font-bold text-cyan-400">{result.completedActions}</div>
              <div className="text-xs text-zinc-400">Actions</div>
            </div>
            <div className="rounded bg-zinc-800 p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{result.errors.length}</div>
              <div className="text-xs text-zinc-400">Errors</div>
            </div>
            <div className="rounded bg-zinc-800 p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{result.screenshots.length}</div>
              <div className="text-xs text-zinc-400">Screenshots</div>
            </div>
          </div>

          {result.screenshots.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-300">Screenshots</h3>
              <div className="grid grid-cols-2 gap-4">
                {result.screenshots.map((name) => (
                  <div key={name} className="overflow-hidden rounded border border-zinc-700">
                    <div className="bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{name}.png</div>
                    <img
                      src={`/api/screenshots?name=${name}`}
                      alt={name}
                      className="w-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
