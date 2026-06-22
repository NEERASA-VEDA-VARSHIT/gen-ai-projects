import type { Page, Locator } from 'playwright';
import path from 'path';
import fs from 'fs';
import { Logger } from '@/logger/logger';
import type { ActionResult, ElementTarget } from '@/types/agent';
import { ElementFinder } from './element-finder';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class ActionRunner {
  private finder: ElementFinder;

  constructor(private page: Page) {
    this.finder = new ElementFinder(page);
  }

  async navigate(url: string): Promise<ActionResult> {
    try {
      Logger.info(`Navigating to ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      Logger.success(`Reached ${url}`);
      return { success: true };
    } catch (error) {
      Logger.error(`Navigation failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async click(x: number, y: number): Promise<ActionResult> {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Invalid document coordinates: (${x}, ${y})`);
      }
      Logger.info(`Clicking at document position (${x}, ${y})`);
      await this.page.evaluate(
        ({ cx, cy }: { cx: number; cy: number }) => {
          window.scrollTo({ top: Math.max(0, cy - window.innerHeight / 2), behavior: 'instant' });
        },
        { cx: x, cy: y }
      );
      await this.page.waitForTimeout(300);
      const scrollX = await this.page.evaluate(() => window.scrollX);
      const scrollY = await this.page.evaluate(() => window.scrollY);
      const vpX = x - scrollX;
      const vpY = y - scrollY;
      await this.page.mouse.click(vpX, vpY);
      await this.page.waitForTimeout(300);
      Logger.success(`Clicked at viewport (${vpX}, ${vpY})`);
      return { success: true };
    } catch (error) {
      Logger.error(`Click failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async clickElement(target: ElementTarget): Promise<ActionResult> {
    try {
      Logger.info(`Finding element: ${target.selector || target.label || target.placeholder || 'coordinates'}`);
      const result = await this.finder.find(target);

      if (!result.success) {
        return { success: false, error: 'Element not found by any strategy' };
      }

      if (result.method === 'coordinate' && target.coordinates) {
        return this.click(target.coordinates.x, target.coordinates.y);
      }

      if (result.locator) {
        await result.locator.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(200);
        await result.locator.click();
        await this.page.waitForTimeout(200);
        Logger.success(`Clicked element via ${result.method}`);
        return { success: true, data: { method: result.method } };
      }

      return { success: false, error: 'No locator resolved' };
    } catch (error) {
      Logger.error(`clickElement failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async focusElement(target: ElementTarget): Promise<ActionResult> {
    try {
      Logger.info(`Focusing element: ${target.selector || target.label || target.placeholder || 'coordinates'}`);
      const result = await this.finder.find(target);

      if (!result.success) {
        return { success: false, error: 'Element not found for focus' };
      }

      if (result.method === 'coordinate' && target.coordinates) {
        const clickResult = await this.click(target.coordinates.x, target.coordinates.y);
        return clickResult;
      }

      if (result.locator) {
        await result.locator.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(200);
        await result.locator.focus();
        await this.page.waitForTimeout(100);
        Logger.success(`Focused element via ${result.method}`);
        return { success: true, data: { method: result.method } };
      }

      return { success: false, error: 'No locator resolved' };
    } catch (error) {
      Logger.error(`focusElement failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async doubleClick(x: number, y: number): Promise<ActionResult> {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Invalid document coordinates: (${x}, ${y})`);
      }
      Logger.info(`Double-clicking at document position (${x}, ${y})`);
      await this.page.evaluate((cy: number) => {
        window.scrollTo({ top: Math.max(0, cy - window.innerHeight / 2), behavior: 'instant' });
      }, y);
      await this.page.waitForTimeout(300);
      const scroll = await this.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
      await this.page.mouse.dblclick(x - scroll.x, y - scroll.y);
      Logger.success(`Double-clicked document position (${x}, ${y})`);
      return { success: true };
    } catch (error) {
      Logger.error(`Double-click failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async type(text: string): Promise<ActionResult> {
    try {
      Logger.info(`Typing text: "${text}"`);
      await this.page.keyboard.press('Control+a');
      await this.page.keyboard.press('Delete');
      await this.page.waitForTimeout(50);
      await this.page.keyboard.type(text, { delay: 30 });
      Logger.success(`Typed text: "${text}"`);
      return { success: true };
    } catch (error) {
      Logger.error(`Type failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async scroll(amount: number): Promise<ActionResult> {
    try {
      Logger.info(`Scrolling by ${amount}px`);
      await this.page.evaluate(
        (delta: number) => window.scrollBy({ top: delta, behavior: 'smooth' }),
        amount
      );
      await this.page.waitForTimeout(500);
      Logger.success(`Scrolled by ${amount}px`);
      return { success: true };
    } catch (error) {
      Logger.error(`Scroll failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async screenshot(name: string): Promise<ActionResult> {
    try {
      ensureDir(SCREENSHOT_DIR);
      const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
      Logger.info(`Taking screenshot: ${name}`);
      await this.page.screenshot({ path: filePath, fullPage: true });
      Logger.success(`Screenshot saved: ${name}.png`);
      return { success: true, data: { path: filePath, name } };
    } catch (error) {
      Logger.error(`Screenshot failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async getPageHtml(): Promise<string> {
    return this.page.content();
  }

  async pressEnter(): Promise<ActionResult> {
    try {
      Logger.info('Pressing Enter');
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(500);
      Logger.success('Pressed Enter');
      return { success: true };
    } catch (error) {
      Logger.error(`Press Enter failed: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }
}
