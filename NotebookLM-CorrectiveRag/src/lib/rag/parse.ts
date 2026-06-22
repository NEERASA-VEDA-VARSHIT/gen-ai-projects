import path from 'node:path';
import { pathToFileURL } from 'node:url';

class SimpleDOMMatrix {
  constructor() {}
}

class SimpleImageData {
  constructor() {}
}

class SimplePath2D {
  constructor() {}
}

function ensurePdfJsPolyfills() {
  const globalScope = globalThis as unknown as {
    DOMMatrix?: unknown;
    DOMMatrixReadOnly?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };

  globalScope.DOMMatrix ??= SimpleDOMMatrix;
  globalScope.DOMMatrixReadOnly ??= SimpleDOMMatrix;
  globalScope.ImageData ??= SimpleImageData;
  globalScope.Path2D ??= SimplePath2D;
}

export async function extractTextFromFile(file: File): Promise<string> {
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    ensurePdfJsPolyfills();
    const { PDFParse } = await import('pdf-parse');
    const workerPath = path.join(process.cwd(), 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'web', 'pdf.worker.mjs');
    PDFParse.setWorker(pathToFileURL(workerPath).href);
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  return fileBuffer.toString('utf8');
}