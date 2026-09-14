export const RUNE_SIZE_PX = {
  sm: 22,
  md: 40,
  lg: 64,
  xl: 96,
} as const;

export type RuneChargeSize = keyof typeof RUNE_SIZE_PX;

/** Full-screen boot / dispatch mark — lg on very small phones, xl otherwise. */
export function runeSizeForShortSide(shortSide: number): RuneChargeSize {
  return shortSide < 360 ? 'lg' : 'xl';
}

/** Below this window height the full-screen block (rune + title + body + CTAs) drops to lg. */
export const RUNE_SHORT_WINDOW_HEIGHT = 560;

/**
 * Full-screen boot / dispatch mark sized for the whole window: lg on narrow phones
 * (iPhone SE, Slide Over) and on short windows (landscape phones, short desktop web), xl otherwise.
 */
export function runeSizeForWindow(width: number, height: number): RuneChargeSize {
  if (height < RUNE_SHORT_WINDOW_HEIGHT) return 'lg';
  return runeSizeForShortSide(Math.min(width, height));
}
