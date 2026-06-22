import type { Page } from 'playwright';
import type { ActionResult } from '@/types/agent';
import { Logger } from '@/logger/logger';

export async function scroll(page: Page, amount: number): Promise<ActionResult> {
  try {
    Logger.info(`Executing tool: scroll ${amount}px`);
    await page.evaluate(
      (delta: number) => window.scrollBy({ top: delta, behavior: 'smooth' }),
      amount
    );
    await page.waitForTimeout(500);
    Logger.success(`scroll completed: ${amount}px`);
    return { success: true, data: { amount } };
  } catch (error) {
    Logger.error(`scroll failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
