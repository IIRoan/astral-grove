import { afterEach, describe, expect, test } from 'bun:test';
import {
  isSheetDismissSuppressed,
  resetSheetDismissSuppress,
  SHEET_DISMISS_SUPPRESS_AFTER_FULLSCREEN_MS,
  shouldIgnoreSheetBackdropPress,
  shouldIgnoreSpuriousSheetDismiss,
  suppressSheetDismiss,
} from '@/lib/sheet-dismiss-guard';

describe('sheet dismiss guard', () => {
  afterEach(() => {
    resetSheetDismissSuppress();
  });

  test('ignores Gorhom -1 until the fullscreen settle window elapses', () => {
    const start = 1_000_000;
    suppressSheetDismiss(SHEET_DISMISS_SUPPRESS_AFTER_FULLSCREEN_MS, start);
    expect(isSheetDismissSuppressed(start)).toBe(true);
    expect(
      isSheetDismissSuppressed(start + SHEET_DISMISS_SUPPRESS_AFTER_FULLSCREEN_MS - 1)
    ).toBe(true);
    expect(
      isSheetDismissSuppressed(start + SHEET_DISMISS_SUPPRESS_AFTER_FULLSCREEN_MS)
    ).toBe(false);
  });

  test('does not suppress when fullscreen was never opened', () => {
    expect(isSheetDismissSuppressed(1_000_000)).toBe(false);
  });

  test('ignores leftover backdrop press and spurious Gorhom -1, not a close already in flight', () => {
    const leftover = { suppressed: true, alreadyDismissing: false };
    const inFlight = { suppressed: true, alreadyDismissing: true };
    const idle = { suppressed: false, alreadyDismissing: false };

    expect(shouldIgnoreSheetBackdropPress(leftover)).toBe(true);
    expect(shouldIgnoreSpuriousSheetDismiss(leftover)).toBe(true);
    expect(shouldIgnoreSheetBackdropPress(inFlight)).toBe(false);
    expect(shouldIgnoreSpuriousSheetDismiss(inFlight)).toBe(false);
    expect(shouldIgnoreSheetBackdropPress(idle)).toBe(false);
    expect(shouldIgnoreSpuriousSheetDismiss(idle)).toBe(false);
  });
});
