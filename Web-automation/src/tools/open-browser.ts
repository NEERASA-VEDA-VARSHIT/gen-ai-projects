import type { ActionResult } from '@/types/agent';
import { BrowserManager } from '@/browser/browser-manager';
import { Logger } from '@/logger/logger';

export async function openBrowser(
  browserManager: BrowserManager,
  headless: boolean
): Promise<ActionResult> {
  try {
    Logger.info('Executing tool: open_browser');
    await browserManager.init(headless);
    Logger.success('open_browser completed');
    return { success: true };
  } catch (error) {
    Logger.error(`open_browser failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
