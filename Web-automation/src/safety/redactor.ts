const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(password|passwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*['"]?\S+/gi,
  /\b(token|secret|key|credential|cred)\s*[:=]\s*['"]?\S{8,}/gi,
  /(?:credit[_-]?card|cc[_-]?num|card[_-]?number)\s*[:=]\s*['"]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/gi,
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
];

export function redactSensitive(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const parts = match.split(/[:=]\s*/);
      if (parts.length >= 2) {
        return `${parts[0]}=REDACTED`;
      }
      return '***REDACTED***';
    });
  }
  result = result.replace(
    /(?<=\?|&)([^&=]+)=([^&=]+)/g,
    (match, key) => {
      const sensitiveKeys = /password|passwd|secret|token|api[_-]?key|key|auth/i;
      if (sensitiveKeys.test(key)) {
        return `${key}=REDACTED`;
      }
      return match;
    }
  );
  return result;
}

export function redactTypedText(text: string): string {
  if (text.length <= 4) return '****';
  return text.substring(0, 2) + '...' + text.substring(text.length - 1);
}

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  const msg = String(error);
  const pathStripped = msg.replace(/(?:at\s+)?(?:[A-Za-z]:)?[\\/](?:[^\\/]+[\\/])+(?:[^\\/]+\.[a-z]+)(?::\d+:\d+)?/gi, '[path]');
  const stackStripped = pathStripped.split('\n')[0];
  const lengthLimited = stackStripped.length > 500 ? stackStripped.substring(0, 500) + '...' : stackStripped;
  return redactSensitive(lengthLimited);
}
