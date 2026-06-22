import type { Page } from 'playwright';
import type { ActionResult } from '@/types/agent';
import { Logger } from '@/logger/logger';

export async function sendKeys(page: Page, text: string): Promise<ActionResult> {
  try {
    Logger.info(`Executing tool: send_keys "${text}"`);
    await page.keyboard.type(text, { delay: 30 });
    Logger.success(`send_keys completed: "${text}"`);
    return { success: true, data: { text } };
  } catch (error) {
    Logger.error(`send_keys failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
