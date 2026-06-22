import { chromium, type Browser, type Page } from 'playwright';
import { Logger } from '@/logger/logger';

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(headless: boolean): Promise<void> {
    Logger.info('Launching browser...');
    this.browser = await chromium.launch({
      headless,
    });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1280, height: 800 });
    Logger.success('Browser opened');
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      Logger.info('Browser closed');
    }
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }
    return this.page;
  }

  getBrowser(): Browser {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init() first.');
    }
    return this.browser;
  }

  isInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }
}
