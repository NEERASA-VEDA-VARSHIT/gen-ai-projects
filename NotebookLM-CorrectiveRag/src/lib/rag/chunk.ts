export type TextChunk = {
  content: string;
  chunkIndex: number;
};

const defaultSeparators = ['\n\n', '\n', '. ', ' ', ''];

export function chunkText(text: string, chunkSize = 800, chunkOverlap = 150): TextChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+$/g, '').trim();

  if (!normalized) {
    return [];
  }

  const chunks = splitRecursively(normalized, chunkSize, defaultSeparators);
  const merged: string[] = [];
  let current = '';

  for (const segment of chunks) {
    if (!segment.trim()) {
      continue;
    }

    if (current.length + segment.length + 1 <= chunkSize) {
      current = current ? `${current} ${segment}` : segment;
      continue;
    }

    if (current) {
      merged.push(current.trim());
    }

    if (segment.length > chunkSize) {
      merged.push(...forceChunk(segment, chunkSize));
      current = '';
      continue;
    }

    current = segment;
  }

  if (current) {
    merged.push(current.trim());
  }

  const overlapped = applyOverlap(merged, chunkOverlap);

  return overlapped.map((content, chunkIndex) => ({
    content,
    chunkIndex
  }));
}

function splitRecursively(text: string, chunkSize: number, separators: string[]): string[] {
  if (text.length <= chunkSize || separators.length === 0) {
    return [text];
  }

  const [separator, ...rest] = separators;

  if (!separator) {
    return forceChunk(text, chunkSize);
  }

  const parts = text.split(separator);
  if (parts.length === 1) {
    return splitRecursively(text, chunkSize, rest);
  }

  return parts.flatMap((part) => splitRecursively(part.trim(), chunkSize, rest));
}

function forceChunk(text: string, chunkSize: number): string[] {
  const segments: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    segments.push(text.slice(index, index + chunkSize).trim());
  }

  return segments.filter(Boolean);
}

function applyOverlap(chunks: string[], overlap: number): string[] {
  if (chunks.length <= 1 || overlap <= 0) {
    return chunks;
  }

  return chunks.map((chunk, index) => {
    if (index === 0) {
      return chunk;
    }

    const previous = chunks[index - 1];
    const suffix = previous.slice(Math.max(0, previous.length - overlap)).trim();
    return suffix ? `${suffix} ${chunk}`.trim() : chunk;
  });
}