import { Logger } from '@/logger/logger';

export class GuardError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'GuardError';
  }
}

export interface ValidatedInput {
  task: string;
  url: string;
}

const MAX_TASK_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const ALLOWED_SCHEMES = ['http:', 'https:'];
const SUSPICIOUS_PROTOCOLS = /^(javascript|data|file|vbscript|blob):/i;
const BLOCK_PRIVATE_IPS = false;

const PRIVATE_IP_PATTERN = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.)/;

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
  return PRIVATE_IP_PATTERN.test(hostname);
}

function sanitizeTask(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.length > MAX_TASK_LENGTH) {
    cleaned = cleaned.substring(0, MAX_TASK_LENGTH);
  }
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return cleaned;
}

function validateUrl(raw: string): { valid: boolean; sanitized: string; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, sanitized: '', error: 'URL is required' };
  }

  let cleaned = raw.trim();

  if (cleaned.length > MAX_URL_LENGTH) {
    return { valid: false, sanitized: '', error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters` };
  }

  if (SUSPICIOUS_PROTOCOLS.test(cleaned)) {
    return { valid: false, sanitized: '', error: `URL scheme not allowed: ${cleaned.substring(0, 20)}...` };
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return { valid: false, sanitized: '', error: 'URL is malformed' };
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, sanitized: '', error: `URL scheme "${parsed.protocol}" is not allowed` };
  }

  if (!parsed.hostname || parsed.hostname.length < 1) {
    return { valid: false, sanitized: '', error: 'URL has no hostname' };
  }

  if (BLOCK_PRIVATE_IPS && isPrivateHost(parsed.hostname)) {
    return { valid: false, sanitized: '', error: `URL points to private network: ${parsed.hostname}` };
  }

  cleaned = parsed.toString();

  return { valid: true, sanitized: cleaned };
}

export function validateNavigationUrl(raw: string): string {
  const result = validateUrl(raw);
  if (!result.valid) {
    Logger.warn(`URL validation failed: ${result.error}`);
    throw new GuardError(result.error!, 'INVALID_URL');
  }
  return result.sanitized;
}

export function validateAndSanitize(task: string, url: string): ValidatedInput {
  const sanitizedTask = sanitizeTask(task);

  if (!sanitizedTask || sanitizedTask.length < 1) {
    throw new GuardError('Task description is required and cannot be empty', 'EMPTY_TASK');
  }

  const urlResult = validateUrl(url);
  if (!urlResult.valid) {
    throw new GuardError(urlResult.error!, 'INVALID_URL');
  }

  return { task: sanitizedTask, url: urlResult.sanitized };
}
