import type { Page } from 'playwright';
import type { PageAnalysis, PageElement, Label } from '@/types/agent';
import { Logger } from '@/logger/logger';

interface RawElement {
  tag: string;
  id: string | null;
  name: string | null;
  type: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  textContent: string | null;
  labelText: string | null;
  selector: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}

interface RawAnalysis {
  labels: Label[];
  inputs: RawElement[];
  textareas: RawElement[];
  buttons: RawElement[];
}

export class PageAnalyzer {
  async analyze(page: Page): Promise<PageAnalysis> {
    Logger.info('Analyzing page DOM...');

    const SCRIPT = `(() => {
      var labels = [];
      var inputs = [];
      var textareas = [];
      var buttons = [];

      var scrollX = window.scrollX || window.pageXOffset || 0;
      var scrollY = window.scrollY || window.pageYOffset || 0;

      for (var _i = 0; _i < document.querySelectorAll('label').length; _i++) {
        var _el = document.querySelectorAll('label')[_i];
        var _text = (_el.textContent || '').trim();
        if (_text) {
          labels.push({
            text: _text,
            forId: _el.getAttribute('for'),
            htmlFor: _el.htmlFor || null,
          });
        }
      }

      function _buildSelector(__el) {
        if (__el.id) return '#' + CSS.escape(__el.id);
        if (__el.getAttribute('name')) {
          return __el.tagName.toLowerCase() + '[name="' + CSS.escape(__el.getAttribute('name')) + '"]';
        }
        if (__el.getAttribute('data-testid')) {
          return '[data-testid="' + CSS.escape(__el.getAttribute('data-testid')) + '"]';
        }
        if (__el.getAttribute('aria-label')) {
          return __el.tagName.toLowerCase() + '[aria-label="' + CSS.escape(__el.getAttribute('aria-label')) + '"]';
        }
        var _path = [];
        var _current = __el;
        while (_current && _current !== document.body && _current !== document.documentElement) {
          var _tag = _current.tagName.toLowerCase();
          var _parent = _current.parentElement;
          if (_parent) {
            var _siblings = Array.from(_parent.children).filter(function (s) { return s.tagName === _current.tagName; });
            if (_siblings.length > 1) {
              var _idx = _siblings.indexOf(_current) + 1;
              _tag += ':nth-of-type(' + _idx + ')';
            }
          }
          _path.unshift(_tag);
          _current = _current.parentElement;
        }
        return _path.join(' > ') || __el.tagName.toLowerCase();
      }

      function _extract(__el) {
        var _rect = __el.getBoundingClientRect();
        var _labelText = null;
        var _id = __el.id;

        if (_id) {
          var _label = document.querySelector('label[for="' + CSS.escape(_id) + '"]');
          if (_label) {
            _labelText = (_label.textContent || '').trim() || null;
          }
        }

        if (!_labelText) {
          var _parentLabel = __el.closest('label');
          if (_parentLabel) {
            _labelText = (_parentLabel.textContent || '').trim() || null;
          }
        }

        if (!_labelText) {
          var _ariaLabelledby = __el.getAttribute('aria-labelledby');
          if (_ariaLabelledby) {
            var _labelEl = document.getElementById(_ariaLabelledby);
            if (_labelEl) {
              _labelText = (_labelEl.textContent || '').trim() || null;
            }
          }
        }

        if (!_labelText) {
          _labelText = __el.getAttribute('aria-label');
        }

        var _docX = _rect.x + scrollX;
        var _docY = _rect.y + scrollY;

        return {
          tag: __el.tagName.toLowerCase(),
          id: __el.id || null,
          name: __el.getAttribute('name'),
          type: __el.getAttribute('type'),
          placeholder: __el.getAttribute('placeholder'),
          ariaLabel: __el.getAttribute('aria-label'),
          textContent: (__el.textContent || '').trim() || null,
          labelText: _labelText,
          selector: _buildSelector(__el),
          rect: {
            x: Math.round(_docX),
            y: Math.round(_docY),
            width: Math.round(_rect.width),
            height: Math.round(_rect.height),
            centerX: Math.round(_docX + _rect.width / 2),
            centerY: Math.round(_docY + _rect.height / 2),
          },
        };
      }

      for (var _j = 0; _j < document.querySelectorAll('input').length; _j++) {
        var _inp = document.querySelectorAll('input')[_j];
        var _t = (_inp.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'submit', 'button', 'reset', 'file', 'image'].indexOf(_t) !== -1) continue;
        inputs.push(_extract(_inp));
      }

      for (var _k = 0; _k < document.querySelectorAll('textarea').length; _k++) {
        textareas.push(_extract(document.querySelectorAll('textarea')[_k]));
      }

      for (var _m = 0; _m < document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').length; _m++) {
        buttons.push(_extract(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')[_m]));
      }

      return { labels: labels, inputs: inputs, textareas: textareas, buttons: buttons };
    })()`;
    const raw = await page.evaluate(SCRIPT) as RawAnalysis;

    Logger.info(
      `Detected ${raw.labels.length} labels, ${raw.inputs.length} inputs, ` +
        `${raw.textareas.length} textareas, ${raw.buttons.length} buttons`
    );

    return {
      url: page.url(),
      title: await page.title(),
      labels: raw.labels,
      inputs: raw.inputs,
      textareas: raw.textareas,
      buttons: raw.buttons,
    };
  }

  matchFieldsByHeuristic(
    analysis: PageAnalysis,
    targetLabels: string[]
  ): Array<{ element: PageElement; label: string }> {
    const matched: Array<{ element: PageElement; label: string }> = [];
    const allFields = [...analysis.inputs, ...analysis.textareas];

    for (const target of targetLabels) {
      const lower = target.toLowerCase();
      let field: PageElement | undefined;

      field = allFields.find((f) => f.labelText?.toLowerCase().includes(lower));

      if (!field) {
        field = allFields.find((f) => f.placeholder?.toLowerCase().includes(lower));
      }
      if (!field) {
        field = allFields.find((f) => f.name?.toLowerCase().includes(lower));
      }
      if (!field) {
        field = allFields.find((f) => f.id?.toLowerCase().includes(lower));
      }
      if (!field) {
        field = allFields.find((f) => f.ariaLabel?.toLowerCase().includes(lower));
      }
      if (!field) {
        field = allFields.find((f) => f.type?.toLowerCase() === lower);
      }

      if (field) {
        matched.push({ element: field, label: target });
      }
    }

    return matched;
  }
}
