import { Logger } from '@/logger/logger';
import { validatePlanResult, validateElementTarget } from '@/config/guardrails';
import type { PlanResult, ElementTarget, Step } from '@/types/agent';

export class OutputGuardError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalOutput?: unknown
  ) {
    super(message);
    this.name = 'OutputGuardError';
  }
}

function sanitizeStepText(text: string, maxLen: number = 10000): string {
  if (text.length > maxLen) {
    throw new OutputGuardError(
      `Text exceeds maximum length (${text.length} > ${maxLen})`,
      'TEXT_TOO_LONG'
    );
  }
  const dangerous = /[<>&"'\\]|javascript:|data:|vbscript:/i;
  if (dangerous.test(text)) {
    Logger.warn(`Suspicious characters detected in text for typing, length=${text.length}`);
  }
  return text;
}

function sanitizeSelector(selector: string): string {
  const dangerous = /javascript:|data:|vbscript:|on\w+=|<script|</i;
  if (dangerous.test(selector)) {
    throw new OutputGuardError(
      `Selector contains potentially dangerous content`,
      'DANGEROUS_SELECTOR'
    );
  }
  return selector;
}

function validateCoordinates(x: number, y: number): void {
  const MAX_COORD = 100000;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new OutputGuardError(`Invalid coordinates: (${x}, ${y})`, 'INVALID_COORDINATES');
  }
  if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) {
    throw new OutputGuardError(
      `Coordinates out of bounds: (${x}, ${y}) exceeds max ${MAX_COORD}`,
      'COORDINATES_OUT_OF_BOUNDS'
    );
  }
}

export function guardPlanOutput(data: unknown): PlanResult {
  const validated = validatePlanResult(data);
  if (!validated.valid) {
    throw new OutputGuardError(
      `LLM output validation failed: ${validated.error}`,
      'INVALID_PLAN_SCHEMA',
      data
    );
  }

  for (const step of validated.data.steps) {
    guardStepOutput(step);
  }

  return validated.data as PlanResult;
}

export function guardStepOutput(step: Step): void {
  const params = step.params || {};

  switch (step.action) {
    case 'click_element':
    case 'focus_element': {
      const target = params.target as Record<string, unknown> | undefined;
      if (!target) {
        throw new OutputGuardError(`Step "${step.action}" missing target`, 'MISSING_TARGET');
      }
      const validated = validateElementTarget(target);
      if (!validated.valid) {
        throw new OutputGuardError(
          `Step "${step.action}" invalid target: ${validated.error}`,
          'INVALID_TARGET'
        );
      }
      if (validated.data.selector) {
        sanitizeSelector(validated.data.selector);
      }
      if (validated.data.coordinates) {
        validateCoordinates(validated.data.coordinates.x, validated.data.coordinates.y);
      }
      break;
    }

    case 'click_on_screen': {
      const x = params.x as number;
      const y = params.y as number;
      validateCoordinates(x, y);
      break;
    }

    case 'send_keys': {
      const text = params.text as string;
      if (typeof text !== 'string' || text.length === 0) {
        throw new OutputGuardError('send_keys requires non-empty text', 'MISSING_TEXT');
      }
      sanitizeStepText(text);
      break;
    }

    case 'navigate_to_url': {
      const url = params.url as string;
      if (typeof url !== 'string' || url.length === 0) {
        throw new OutputGuardError('navigate_to_url requires a URL', 'MISSING_URL');
      }
      const dangerous = /^(javascript|data|file|vbscript):/i;
      if (dangerous.test(url)) {
        throw new OutputGuardError(`Blocked dangerous navigation URL: ${url.substring(0, 50)}`, 'DANGEROUS_URL');
      }
      break;
    }

    case 'scroll': {
      const amount = params.amount as number;
      if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        throw new OutputGuardError('scroll requires a finite amount', 'INVALID_SCROLL');
      }
      if (Math.abs(amount) > 100000) {
        throw new OutputGuardError('Scroll amount out of bounds', 'SCROLL_OUT_OF_BOUNDS');
      }
      break;
    }

    case 'take_screenshot': {
      const name = params.name as string;
      if (typeof name !== 'string' || name.length === 0) {
        throw new OutputGuardError('take_screenshot requires a name', 'MISSING_SCREENSHOT_NAME');
      }
      if (name.length > 200) {
        throw new OutputGuardError('Screenshot name too long', 'SCREENSHOT_NAME_TOO_LONG');
      }
      break;
    }

    case 'verify_fill': {
      const values = params.expectedValues as string[] | undefined;
      if (!Array.isArray(values) || values.length === 0) {
        throw new OutputGuardError('verify_fill requires expectedValues array', 'MISSING_EXPECTED_VALUES');
      }
      if (values.some((v) => typeof v !== 'string')) {
        throw new OutputGuardError('verify_fill expectedValues must be strings', 'INVALID_EXPECTED_VALUES');
      }
      if (values.some((v) => v.length > 10000)) {
        throw new OutputGuardError('verify_fill value too long', 'EXPECTED_VALUE_TOO_LONG');
      }
      break;
    }

    case 'reanalyze_page':
    case 'press_enter':
    case 'analyze_page':
    case 'open_browser':
    case 'double_click':
      break;

    default:
      throw new OutputGuardError(`Unknown action: ${step.action}`, 'UNKNOWN_ACTION');
  }
}
