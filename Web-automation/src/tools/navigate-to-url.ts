import type { Page } from 'playwright';
import type { ActionResult } from '@/types/agent';
import { Logger } from '@/logger/logger';

export async function navigateToUrl(page: Page, url: string): Promise<ActionResult> {
  try {
    Logger.info(`Executing tool: navigate_to_url ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    Logger.success(`navigate_to_url completed: ${url}`);
    return { success: true, data: { url } };
  } catch (error) {
    Logger.error(`navigate_to_url failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
