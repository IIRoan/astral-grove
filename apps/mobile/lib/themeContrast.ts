/** Contrast checks for archive theme tokens (OKLCH → sRGB relative luminance). */

export type ThemeMode = 'light' | 'dark';

/** OKLCH tuples from global.css archive tokens (C=0 neutrals). */
export const ARCHIVE_THEME_OKLCH: Record<
  ThemeMode,
  { foreground: number; card: number; mutedForeground: number; cardPanel: number }
> = {
  dark: {
    foreground: 0.96,
    card: 0.175,
    mutedForeground: 0.72,
    cardPanel: 0.215,
  },
  light: {
    foreground: 0.18,
    card: 1.0,
    mutedForeground: 0.48,
    cardPanel: 0.94,
  },
};

/** OKLCH neutral (C=0) → WCAG relative luminance. */
export function oklchNeutralLuminance(L: number): number {
  const l_ = L;
  const m_ = L;
  const s_ = L;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  const rl = toLinear(Math.max(0, r));
  const gl = toLinear(Math.max(0, g));
  const bl = toLinear(Math.max(0, b));

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast ratio from two relative luminances (0–1). */
export function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastForOklchNeutral(
  foregroundL: number,
  backgroundL: number
): number {
  return contrastRatio(
    oklchNeutralLuminance(foregroundL),
    oklchNeutralLuminance(backgroundL)
  );
}

const BODY_TEXT_MIN = 4.5;
const LARGE_UI_MIN = 3.0;

export function meetsBodyTextContrast(
  foregroundL: number,
  backgroundL: number
): boolean {
  return contrastForOklchNeutral(foregroundL, backgroundL) >= BODY_TEXT_MIN;
}

export function meetsLargeUiContrast(
  foregroundL: number,
  backgroundL: number
): boolean {
  return contrastForOklchNeutral(foregroundL, backgroundL) >= LARGE_UI_MIN;
}

/** Assert toolbar-relevant pairs meet contrast in both themes. */
export function toolbarContrastReport(): {
  mode: ThemeMode;
  foregroundOnCard: number;
  mutedOnCard: number;
  foregroundOnPanel: number;
}[] {
  return (['light', 'dark'] as const).map((mode) => {
    const t = ARCHIVE_THEME_OKLCH[mode];
    return {
      mode,
      foregroundOnCard: contrastForOklchNeutral(t.foreground, t.card),
      mutedOnCard: contrastForOklchNeutral(t.mutedForeground, t.card),
      foregroundOnPanel: contrastForOklchNeutral(t.foreground, t.cardPanel),
    };
  });
}
