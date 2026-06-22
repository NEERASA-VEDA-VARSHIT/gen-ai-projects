import type { Page, Locator } from 'playwright';
import type { ElementTarget } from '@/types/agent';
import { Logger } from '@/logger/logger';

interface FindResult {
  locator: Locator | null;
  success: boolean;
  method: string;
}

export class ElementFinder {
  constructor(private page: Page) {}

  async find(target: ElementTarget): Promise<FindResult> {
    const strategies: Array<() => Promise<FindResult>> = [
      () => this.trySelector(target),
      () => this.tryLabel(target),
      () => this.tryPlaceholder(target),
      () => this.tryAriaLabel(target),
      () => this.tryText(target),
      () => this.tryCoordinate(target),
    ];

    for (const strategy of strategies) {
      const result = await strategy();
      if (result.success) {
        Logger.success(`Element found via: ${result.method}`);
        return result;
      }
      Logger.warn(`Strategy ${result.method} failed`);
    }

    return { locator: null, success: false, method: 'none' };
  }

  private async trySelector(target: ElementTarget): Promise<FindResult> {
    if (!target.selector) return { locator: null, success: false, method: 'selector' };
    try {
      const locator = this.page.locator(target.selector);
      const count = await locator.count();
      if (count > 0) return { locator, success: true, method: 'selector' };
    } catch { /* ignore */ }
    return { locator: null, success: false, method: 'selector' };
  }

  private async tryLabel(target: ElementTarget): Promise<FindResult> {
    const label = target.label;
    if (!label) return { locator: null, success: false, method: 'label' };
    try {
      const locator = this.page.getByLabel(label, { exact: false });
      const count = await locator.count();
      if (count > 0) return { locator, success: true, method: 'label' };
    } catch { /* ignore */ }
    return { locator: null, success: false, method: 'label' };
  }

  private async tryPlaceholder(target: ElementTarget): Promise<FindResult> {
    const placeholder = target.placeholder;
    if (!placeholder) return { locator: null, success: false, method: 'placeholder' };
    try {
      const locator = this.page.getByPlaceholder(placeholder);
      const count = await locator.count();
      if (count > 0) return { locator, success: true, method: 'placeholder' };
    } catch { /* ignore */ }
    return { locator: null, success: false, method: 'placeholder' };
  }

  private async tryAriaLabel(target: ElementTarget): Promise<FindResult> {
    const ariaLabel = target.ariaLabel;
    if (!ariaLabel) return { locator: null, success: false, method: 'ariaLabel' };
    try {
      const locator = this.page.getByRole('textbox', { name: ariaLabel });
      const count = await locator.count();
      if (count > 0) return { locator, success: true, method: 'ariaLabel' };
    } catch { /* ignore */ }
    try {
      const locator = this.page.locator(`[aria-label="${CSS.escape(ariaLabel)}"]`);
      const count = await locator.count();
      if (count > 0) return { locator, success: true, method: 'ariaLabel' };
    } catch { /* ignore */ }
    return { locator: null, success: false, method: 'ariaLabel' };
  }

  private async tryText(target: ElementTarget): Promise<FindResult> {
    const text = target.textContent || target.label;
    if (!text) return { locator: null, success: false, method: 'text' };
    try {
      const locator = this.page.getByText(text, { exact: false });
      const count = await locator.count();
      if (count > 0) {
        const buttonLocator = this.page.getByRole('button', { name: text });
        const btnCount = await buttonLocator.count();
        if (btnCount > 0) return { locator: buttonLocator, success: true, method: 'text' };
        return { locator, success: true, method: 'text' };
      }
    } catch { /* ignore */ }
    return { locator: null, success: false, method: 'text' };
  }

  private async tryCoordinate(target: ElementTarget): Promise<FindResult> {
    if (!target.coordinates) return { locator: null, success: false, method: 'coordinate' };
    return { locator: null, success: true, method: 'coordinate' };
  }
}
