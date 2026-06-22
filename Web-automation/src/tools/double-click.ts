import type { Page } from 'playwright';
import type { ActionResult } from '@/types/agent';
import { Logger } from '@/logger/logger';

export async function doubleClick(
  page: Page,
  x: number,
  y: number
): Promise<ActionResult> {
  try {
    Logger.info(`Executing tool: double_click (${x}, ${y})`);
    await page.mouse.dblclick(x, y);
    Logger.success(`double_click completed at (${x}, ${y})`);
    return { success: true, data: { x, y } };
  } catch (error) {
    Logger.error(`double_click failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
