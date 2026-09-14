import type { Page } from '@playwright/test';

export type LayoutIssue = {
  kind: 'offscreen' | 'clipped' | 'page-overflow';
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  detail: string;
};

type AuditOptions = {
  /** Allowed px of sub-pixel slop. */
  tolerance?: number;
  /** Also check the vertical axis (use on screens that should fit without scrolling, e.g. chrome). */
  vertical?: boolean;
  /** CSS selector scoping which elements are audited (default: whole document). */
  within?: string;
};

/**
 * Finds interactive controls and text that are pushed outside the viewport or clipped
 * by an `overflow: hidden` ancestor — the "cut off on this device" class of bug.
 *
 * Horizontal checks run everywhere. Elements inside a scroll container on that axis are
 * exempt (scrolling to them is intended), as are invisible / zero-size nodes.
 */
export async function auditLayout(
  page: Page,
  options: AuditOptions = {}
): Promise<LayoutIssue[]> {
  return page.evaluate(
    ({ tolerance, vertical, within }) => {
      const issues: LayoutIssue[] = [];
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;

      if (document.documentElement.scrollWidth > vw + tolerance) {
        issues.push({
          kind: 'page-overflow',
          label: 'document',
          rect: { x: 0, y: 0, width: document.documentElement.scrollWidth, height: 0 },
          detail: `scrollWidth ${document.documentElement.scrollWidth} > viewport ${vw}`,
        });
      }

      const root: ParentNode = within
        ? (document.querySelector(within) ?? document)
        : document;
      const selector = [
        '[role="button"]',
        '[role="tab"]',
        '[role="link"]',
        '[role="switch"]',
        '[role="checkbox"]',
        'button',
        'a[href]',
        'input',
        'textarea',
      ].join(',');

      const candidates = new Set<Element>(root.querySelectorAll(selector));
      // Text leaves: elements whose own text nodes carry visible characters.
      for (const el of root.querySelectorAll('div, span')) {
        const hasOwnText = Array.from(el.childNodes).some(
          (n) =>
            n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0
        );
        if (hasOwnText) candidates.add(el);
      }

      const isHidden = (el: Element): boolean => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) < 0.05 ||
            node.getAttribute('aria-hidden') === 'true'
          ) {
            return true;
          }
        }
        return false;
      };

      const scrolls = (style: CSSStyleDeclaration, axis: 'x' | 'y') => {
        const v = axis === 'x' ? style.overflowX : style.overflowY;
        return v === 'auto' || v === 'scroll';
      };

      const labelOf = (el: Element) => {
        const aria = el.getAttribute('aria-label');
        const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
        const base =
          aria || text || el.getAttribute('placeholder') || el.tagName.toLowerCase();
        return base.slice(0, 60);
      };

      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (isHidden(el)) continue;
        // Parked offscreen on purpose (unmeasured popovers use -9999).
        if (rect.right < -1000 || rect.left > vw + 1000 || rect.top < -1000) continue;

        let inScrollX = false;
        let inScrollY = false;
        let clipLeft = 0;
        let clipRight = vw;
        let clipTop = 0;
        let clipBottom = vh;
        let clipper: Element | null = null;

        for (
          let node = el.parentElement;
          node && node !== document.body;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (scrolls(style, 'x')) inScrollX = true;
          if (scrolls(style, 'y')) inScrollY = true;
          const r = node.getBoundingClientRect();
          if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
            if (r.left > clipLeft) {
              clipLeft = r.left;
              clipper = node;
            }
            if (r.right < clipRight) {
              clipRight = r.right;
              clipper = node;
            }
          }
          if (
            vertical &&
            (style.overflowY === 'hidden' || style.overflowY === 'clip')
          ) {
            clipTop = Math.max(clipTop, r.top);
            clipBottom = Math.min(clipBottom, r.bottom);
          }
        }

        const r = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };

        if (!inScrollX) {
          if (rect.left < -tolerance || rect.right > vw + tolerance) {
            issues.push({
              kind: 'offscreen',
              label: labelOf(el),
              rect: r,
              detail: `x ${Math.round(rect.left)}..${Math.round(rect.right)} outside viewport 0..${vw}`,
            });
            continue;
          }
          if (rect.left < clipLeft - tolerance || rect.right > clipRight + tolerance) {
            issues.push({
              kind: 'clipped',
              label: labelOf(el),
              rect: r,
              detail: `x ${Math.round(rect.left)}..${Math.round(rect.right)} clipped to ${Math.round(clipLeft)}..${Math.round(clipRight)} by ${clipper?.tagName.toLowerCase()}${clipper?.getAttribute('data-testid') ? `#${clipper.getAttribute('data-testid')}` : ''}`,
            });
            continue;
          }
        }

        if (vertical && !inScrollY) {
          if (rect.top < -tolerance || rect.bottom > vh + tolerance) {
            issues.push({
              kind: 'offscreen',
              label: labelOf(el),
              rect: r,
              detail: `y ${Math.round(rect.top)}..${Math.round(rect.bottom)} outside viewport 0..${vh}`,
            });
          } else if (
            rect.top < clipTop - tolerance ||
            rect.bottom > clipBottom + tolerance
          ) {
            issues.push({
              kind: 'clipped',
              label: labelOf(el),
              rect: r,
              detail: `y ${Math.round(rect.top)}..${Math.round(rect.bottom)} clipped to ${Math.round(clipTop)}..${Math.round(clipBottom)}`,
            });
          }
        }
      }

      return issues;
    },
    {
      tolerance: options.tolerance ?? 1,
      vertical: options.vertical ?? false,
      within: options.within ?? null,
    }
  );
}

export function formatIssues(issues: LayoutIssue[]): string {
  return issues.map((i) => `  [${i.kind}] "${i.label}" — ${i.detail}`).join('\n');
}

/**
 * Fixed chrome (not inside a scroll container) that overlaps the bottom tab bar —
 * e.g. floating action buttons or toasts parked on top of a tab.
 */
export async function findTabBarOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const tablists = Array.from(document.querySelectorAll('[role="tablist"]')).filter(
      (el) =>
        Array.from(el.querySelectorAll('[role="tab"]')).some((t) =>
          /^(Cards|Collection|Decks)$/.test(t.getAttribute('aria-label') ?? '')
        )
    );
    const bar = tablists.find((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > window.innerHeight * 0.75 && r.width > 0;
    });
    if (!bar) return [];
    const barRect = bar.getBoundingClientRect();
    const overlaps: string[] = [];

    const inScroll = (el: Element) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.overflowY === 'auto' || s.overflowY === 'scroll') return true;
      }
      return false;
    };

    for (const el of document.querySelectorAll(
      '[role="button"], [role="switch"], button'
    )) {
      if (bar.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || Number(style.opacity) < 0.05) continue;
      if (inScroll(el)) continue;
      const ix = Math.min(r.right, barRect.right) - Math.max(r.left, barRect.left);
      const iy = Math.min(r.bottom, barRect.bottom) - Math.max(r.top, barRect.top);
      if (ix > 2 && iy > 2) {
        overlaps.push(
          `"${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}" at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
        );
      }
    }
    return overlaps;
  });
}
