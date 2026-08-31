import { describe, expect, test } from 'bun:test';
import {
  applyClosedToMountState,
  applyOpenToMountState,
  beginCatalogDrawerDismiss,
  createCatalogDrawerPresentation,
  finishCatalogDrawerDismiss,
  isBottomSheetStuck,
  isCatalogDrawerBlockingTaps,
  isCatalogDrawerClosing,
  isSheetHostCapturingTaps,
  onSheetIndexChange,
  simulateBuggyDismissBeforeParentUpdates,
  simulateDismissCycle,
  simulateQuickReopen,
  type BottomSheetMountState,
} from '@/lib/bottom-sheet-lifecycle';

describe('bottom sheet mount lifecycle', () => {
  test('swipe dismiss must not unmount portal while open stays true', () => {
    const afterDismiss = simulateBuggyDismissBeforeParentUpdates({
      open: true,
      mounted: true,
    });
    expect(isBottomSheetStuck(afterDismiss)).toBe(true);
  });

  test('fixed dismiss cycle never leaves the sheet stuck', () => {
    let state: BottomSheetMountState = { open: false, mounted: false };

    for (let i = 0; i < 25; i += 1) {
      state = simulateDismissCycle(state, 'fixed');
      expect(isBottomSheetStuck(state)).toBe(false);
      expect(state.open).toBe(true);
      expect(state.mounted).toBe(true);
    }
  });

  test('repeated buggy dismiss cycles get stuck without an open toggle', () => {
    let state: BottomSheetMountState = { open: false, mounted: false };

    for (let i = 0; i < 3; i += 1) {
      state = simulateDismissCycle(state, 'buggy');
    }

    expect(isBottomSheetStuck(state)).toBe(true);
  });

  test('open prop mounts portal; closed prop unmounts after parent updates', () => {
    expect(applyOpenToMountState({ open: true, mounted: false })).toEqual({
      open: true,
      mounted: true,
    });
    expect(applyClosedToMountState({ open: false, mounted: true })).toEqual({
      open: false,
      mounted: false,
    });
  });

  test('sheet index -1 only notifies close', () => {
    let notified = false;
    onSheetIndexChange(0, () => {
      notified = true;
    });
    expect(notified).toBe(false);

    onSheetIndexChange(-1, () => {
      notified = true;
    });
    expect(notified).toBe(true);
  });
});

describe('catalog drawer dismiss', () => {
  test('dismiss-start releases taps without clipping the visual host', () => {
    const open = createCatalogDrawerPresentation(1, 'OGN-001');
    expect(isCatalogDrawerBlockingTaps(open)).toBe(true);

    const afterDismiss = beginCatalogDrawerDismiss(open, 1);
    expect(afterDismiss?.variantNumber).toBe('OGN-001');
    expect(isCatalogDrawerClosing(afterDismiss)).toBe(true);
    expect(isCatalogDrawerBlockingTaps(afterDismiss)).toBe(false);
    expect(
      isSheetHostCapturingTaps({ open: afterDismiss?.open === true, sheetIndex: 0 })
    ).toBe(false);

    expect(finishCatalogDrawerDismiss(afterDismiss, 1)).toBeNull();
  });

  test('portal stops capturing taps at dismiss-start while Gorhom is still at index 0', () => {
    expect(isSheetHostCapturingTaps({ open: false, sheetIndex: 0 })).toBe(false);
    expect(isSheetHostCapturingTaps({ open: true, sheetIndex: 0 })).toBe(true);
    expect(isSheetHostCapturingTaps({ open: true, sheetIndex: -1 })).toBe(true);
  });

  test('another card can open before the previous close completion arrives', () => {
    const open = createCatalogDrawerPresentation(1, 'OGN-001');
    const closing = beginCatalogDrawerDismiss(open, 1);
    const reopened = createCatalogDrawerPresentation(2, 'OGN-002');
    const afterStaleCompletion = finishCatalogDrawerDismiss(reopened, 1);

    expect(afterStaleCompletion).toEqual(reopened);
    expect(afterStaleCompletion?.variantNumber).toBe('OGN-002');
    expect(afterStaleCompletion?.open).toBe(true);
    expect(isCatalogDrawerClosing(closing)).toBe(true);
  });

  test('reopening the same card creates a fresh session that stale callbacks cannot close', () => {
    const first = createCatalogDrawerPresentation(1, 'OGN-001');
    const closing = beginCatalogDrawerDismiss(first, 1);
    const reopened = createCatalogDrawerPresentation(2, 'OGN-001');

    expect(beginCatalogDrawerDismiss(reopened, 1)).toEqual(reopened);
    expect(finishCatalogDrawerDismiss(reopened, 1)).toEqual(reopened);
    expect(reopened.sessionId).toBe(2);
    expect(reopened.open).toBe(true);
    expect(isCatalogDrawerClosing(closing)).toBe(true);
  });

  test('rapid dismiss and reopen remains open across many stale completions', () => {
    let presentation = createCatalogDrawerPresentation(1, 'OGN-001');

    for (let sessionId = 2; sessionId <= 80; sessionId += 1) {
      presentation = simulateQuickReopen(
        presentation,
        sessionId,
        sessionId % 2 === 0 ? 'OGN-001' : 'OGN-002'
      );
      expect(presentation.sessionId).toBe(sessionId);
      expect(presentation.open).toBe(true);
      expect(isCatalogDrawerBlockingTaps(presentation)).toBe(true);
    }
  });

  test('duplicate callbacks are monotonic and cannot reopen a closing session', () => {
    const open = createCatalogDrawerPresentation(7, 'OGN-007');
    const closing = beginCatalogDrawerDismiss(open, 7);

    expect(beginCatalogDrawerDismiss(closing, 7)).toEqual(closing);
    expect(isCatalogDrawerClosing(closing)).toBe(true);
    expect(finishCatalogDrawerDismiss(closing, 7)).toBeNull();
  });
});
