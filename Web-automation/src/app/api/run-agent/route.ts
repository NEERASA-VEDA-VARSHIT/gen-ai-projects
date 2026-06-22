import { NextRequest } from 'next/server';
import { BrowserAgent } from '@/agent/browser-agent';
import { Logger } from '@/logger/logger';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const task: string = body.task || 'Find the Name and Description form fields on the page and fill them with test values.';
  const url: string = body.url || 'https://ui.shadcn.com/docs/forms/react-hook-form';

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
        const payload = JSON.stringify({ type: 'result', payload: result });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (error) {
        const payload = JSON.stringify({
          type: 'result',
          payload: {
            success: false,
            summary: 'Agent crashed',
            status: 'failed',
            screenshots: [],
            errors: [String(error)],
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
