import type { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import type { ActionResult } from '@/types/agent';
import { Logger } from '@/logger/logger';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function takeScreenshot(
  page: Page,
  name: string
): Promise<ActionResult> {
  try {
    ensureDir(SCREENSHOT_DIR);
    const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
    Logger.info(`Executing tool: take_screenshot ${name}`);
    await page.screenshot({ path: filePath, fullPage: true });
    Logger.success(`take_screenshot completed: ${name}.png`);
    return { success: true, data: { path: filePath, name } };
  } catch (error) {
    Logger.error(`take_screenshot failed: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}
