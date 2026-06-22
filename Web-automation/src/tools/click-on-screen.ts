import type { Page } from 'playwright';
import type { ActionResult } from '@/types/agent';
import { Logger } from '@/logger/logger';

export async function clickOnScreen(
  page: Page,
  x: number,
  y: number
): Promise<ActionResult> {
  try {
    Logger.info(`Executing tool: click_on_screen (${x}, ${y})`);
    await page.mouse.click(x, y);
    await page.waitForTimeout(300);
    Logger.success(`click_on_screen completed at (${x}, ${y})`);
    return { success: true, data: { x, y } };
  } catch (error) {
    Logger.error(`click_on_screen failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
