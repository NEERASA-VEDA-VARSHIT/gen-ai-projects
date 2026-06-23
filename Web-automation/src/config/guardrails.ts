import { z } from 'zod';

export const ELEMENT_TARGET_SCHEMA = z.object({
  selector: z.string().max(500).optional(),
  label: z.string().max(500).optional(),
  placeholder: z.string().max(500).optional(),
  ariaLabel: z.string().max(500).optional(),
  textContent: z.string().max(2000).optional(),
  tag: z.string().max(50).optional(),
  name: z.string().max(200).optional(),
  id: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  coordinates: z.object({
    x: z.number().finite().safe(),
    y: z.number().finite().safe(),
  }).optional(),
});

export const STEP_SCHEMA = z.object({
  action: z.enum([
    'open_browser', 'navigate_to_url', 'take_screenshot',
    'click_on_screen', 'click_element', 'focus_element',
    'double_click', 'send_keys', 'press_enter', 'scroll',
    'analyze_page', 'verify_fill', 'reanalyze_page',
  ]),
  params: z.record(z.string(), z.unknown()).optional(),
  description: z.string().min(1).max(500),
});

export const PLAN_RESULT_SCHEMA = z.object({
  reasoning: z.string().min(1).max(5000),
  steps: z.array(STEP_SCHEMA).min(1).max(50),
});

export function validatePlanResult(data: unknown): { valid: true; data: z.infer<typeof PLAN_RESULT_SCHEMA> } | { valid: false; error: string } {
  const result = PLAN_RESULT_SCHEMA.safeParse(data);
  if (!result.success) {
    const flat = result.error.flatten();
    const issues = Object.values(flat.fieldErrors).flat().concat(flat.formErrors);
    return { valid: false, error: issues.join('; ') || 'Invalid plan structure' };
  }
  return { valid: true, data: result.data };
}

export function validateElementTarget(data: unknown): { valid: true; data: z.infer<typeof ELEMENT_TARGET_SCHEMA> } | { valid: false; error: string } {
  const result = ELEMENT_TARGET_SCHEMA.safeParse(data);
  if (!result.success) {
    return { valid: false, error: result.error.message };
  }
  return { valid: true, data: result.data };
}
