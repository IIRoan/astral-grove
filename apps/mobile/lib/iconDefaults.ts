/** Global icon defaults — Phosphor regular reads thin/aliased on dark web UIs. */
import type { IconWeight } from 'phosphor-react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { compactMap } from '@/lib/iteration';

/** Default stroke weight for chrome icons (tabs, steppers, toolbars). */
export const APP_ICON_WEIGHT: IconWeight = 'bold';

/** Lighter stroke for tiny chrome (≤16px) — bold at 12–14px looks blocky. */
export function appIconWeightForSize(size: number): IconWeight {
  return size <= 16 ? 'regular' : APP_ICON_WEIGHT;
}

/** Snap to whole pixels — subpixel SVG sizes look jagged in Firefox. */
export function iconPixelSize(size: number | undefined, fallback = 24): number {
  const value = typeof size === 'number' && Number.isFinite(size) ? size : fallback;
  return Math.max(1, Math.round(value));
}

type StyleNode = StyleProp<ViewStyle>;

function walkStyle(style: StyleNode, visit: (node: ViewStyle) => void): void {
  if (style == null || style === false) return;
  if (Array.isArray(style)) {
    for (const entry of style) walkStyle(entry as StyleNode, visit);
    return;
  }
  if (typeof style === 'object') visit(style);
}

/** Read width/height Uniwind mapped from `size-*` classNames. */
export function iconSizeFromStyle(style: StyleNode): number | undefined {
  let size: number | undefined;
  walkStyle(style, (node) => {
    const dim = node.width ?? node.height;
    if (typeof dim === 'number' && Number.isFinite(dim)) size = dim;
  });
  return size;
}

/** Drop width/height so Phosphor's `size` owns metrics (avoids CSS downscale blur). */
export function iconStyleWithoutBoxSize(
  style: StyleNode
): StyleProp<ViewStyle> | undefined {
  if (style == null || style === false) return undefined;
  if (Array.isArray(style)) {
    const next = compactMap(style, (entry) => {
      const normalized = iconStyleWithoutBoxSize(entry as StyleNode);
      return normalized != null && normalized !== false ? normalized : null;
    });
    return next.length > 0 ? next : undefined;
  }
  if (typeof style !== 'object') return style;
  const { width: _w, height: _h, ...rest } = style;
  return rest;
}
