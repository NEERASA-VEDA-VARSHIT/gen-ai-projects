import { NextRequest } from 'next/server';
import { BrowserAgent } from '@/agent/browser-agent';
import { Logger } from '@/logger/logger';
import { validateAndSanitize, GuardError } from '@/safety/input-guard';
import { sanitizeErrorMessage } from '@/safety/redactor';
import { InputJudge, JudgeTripwireError } from '@/safety/judge-guard';

const MAX_BODY_BYTES = 1_048_576;

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ error: 'Content-Type must be application/json' }),
      { status: 415, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf-8') > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }
    body = JSON.parse(text);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rawTask: string = (body.task as string) || 'Find the Name and Description form fields on the page and fill them with test values.';
  const rawUrl: string = (body.url as string) || 'https://ui.shadcn.com/docs/forms/react-hook-form';

  let task: string;
  let url: string;
  try {
    const validated = validateAndSanitize(rawTask, rawUrl);
    task = validated.task;
    url = validated.url;
  } catch (error) {
    const message = error instanceof GuardError ? error.message : sanitizeErrorMessage(error);
    return new Response(
      JSON.stringify({ error: `Input validation failed: ${message}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const judge = await InputJudge.create();
    await judge.guard(task);
  } catch (error) {
    if (error instanceof JudgeTripwireError) {
      return new Response(
        JSON.stringify({ error: `Input blocked by safety judge: ${error.message}` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    Logger.warn(`Judge unavailable in API, proceeding: ${String(error)}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendLog = (message: string, level: string) => {
        const data = JSON.stringify({ type: 'log', message, level });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const originalInfo = Logger.info.bind(Logger);
      const originalWarn = Logger.warn.bind(Logger);
      const originalError = Logger.error.bind(Logger);
      const originalSuccess = Logger.success.bind(Logger);

      Logger.info = (msg: string) => { originalInfo(msg); sendLog(msg, 'info'); };
      Logger.warn = (msg: string) => { originalWarn(msg); sendLog(msg, 'warn'); };
      Logger.error = (msg: string) => { originalError(msg); sendLog(msg, 'error'); };
      Logger.success = (msg: string) => { originalSuccess(msg); sendLog(msg, 'success'); };

      try {
        const agent = new BrowserAgent();
        const result = await agent.run(task, url);
        const safeResult = {
          ...result,
          errors: result.errors.map(sanitizeErrorMessage),
        };
        const payload = JSON.stringify({ type: 'result', payload: safeResult });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (error) {
        const payload = JSON.stringify({
          type: 'result',
          payload: {
            success: false,
            summary: 'Agent crashed',
            status: 'failed',
            screenshots: [],
            errors: [sanitizeErrorMessage(error)],
            completedActions: 0,
          },
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } finally {
        Logger.info = originalInfo;
        Logger.warn = originalWarn;
        Logger.error = originalError;
        Logger.success = originalSuccess;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
