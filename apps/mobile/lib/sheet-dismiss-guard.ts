/** Gorhom animates to -1 ~1s after the fullscreen overlay unmounts on iOS. */
export const SHEET_DISMISS_SUPPRESS_AFTER_FULLSCREEN_MS = 1500;

let suppressUntil = 0;

export function suppressSheetDismiss(
  durationMs = SHEET_DISMISS_SUPPRESS_AFTER_FULLSCREEN_MS,
  now = Date.now()
): void {
  suppressUntil = now + durationMs;
}

export function isSheetDismissSuppressed(now = Date.now()): boolean {
  return now < suppressUntil;
}

export function resetSheetDismissSuppress(): void {
  suppressUntil = 0;
}

export function sheetDismissSuppressRemainingMs(now = Date.now()): number {
  return Math.max(0, suppressUntil - now);
}

/** Leftover backdrop tap or spurious Gorhom -1 after fullscreen unmount, not a close already in flight. */
export function shouldIgnoreSpuriousSheetDismiss(input: {
  suppressed: boolean;
  alreadyDismissing: boolean;
}): boolean {
  return input.suppressed && !input.alreadyDismissing;
}

/** Fullscreen dismiss tap can fall through to the drawer backdrop. */
export function shouldIgnoreSheetBackdropPress(input: {
  suppressed: boolean;
  alreadyDismissing: boolean;
}): boolean {
  return shouldIgnoreSpuriousSheetDismiss(input);
}

/** Gorhom can ignore index=-1 after a sibling overlay unmounts; unmount the ghost host. */
export const SHEET_CLOSE_FALLBACK_MS = 1200;
