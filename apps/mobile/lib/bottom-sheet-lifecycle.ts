/** Catalog drawer session: new id per tap; dismiss-start clears hit-testing but stays mounted until Gorhom finishes close. */
export type CatalogDrawerPresentation = {
  sessionId: number;
  variantNumber: string;
  open: boolean;
};

export type BottomSheetMountState = {
  open: boolean;
  mounted: boolean;
};

/** Portal is stuck when parent expects the sheet open but content was unmounted. */
export function isBottomSheetStuck(state: BottomSheetMountState): boolean {
  return state.open && !state.mounted;
}

/** Opening always keeps the portal mounted. */
export function applyOpenToMountState(
  state: BottomSheetMountState
): BottomSheetMountState {
  if (state.open) {
    return { ...state, mounted: true };
  }
  return state;
}

/** Parent closed the sheet — portal can unmount. */
export function applyClosedToMountState(
  state: BottomSheetMountState
): BottomSheetMountState {
  if (!state.open) {
    return { ...state, mounted: false };
  }
  return state;
}

/** Gorhom reports a snap index change; dismiss only notifies the parent. */
export function onSheetIndexChange(index: number, notifyClosed: () => void): void {
  if (index === -1) {
    notifyClosed();
  }
}

/** Legacy buggy dismiss: unmounts portal while `open` is still true, blocking reopen until open toggles. */
export function simulateBuggyDismissBeforeParentUpdates(
  state: BottomSheetMountState
): BottomSheetMountState {
  if (!state.open) {
    return state;
  }
  return { open: true, mounted: false };
}

/** Run open → swipe dismiss → parent close → reopen cycles. */
export function simulateDismissCycle(
  state: BottomSheetMountState,
  dismissMode: 'buggy' | 'fixed'
): BottomSheetMountState {
  let next = applyOpenToMountState({ ...state, open: true });
  if (dismissMode === 'buggy') {
    next = simulateBuggyDismissBeforeParentUpdates(next);
    return next;
  }
  onSheetIndexChange(-1, () => {
    next = applyClosedToMountState({ ...next, open: false });
  });
  return applyOpenToMountState({ ...next, open: true });
}

export function createCatalogDrawerPresentation(
  sessionId: number,
  variantNumber: string
): CatalogDrawerPresentation {
  return {
    sessionId,
    variantNumber,
    open: true,
  };
}

export function isCatalogDrawerBlockingTaps(
  presentation: CatalogDrawerPresentation | null
): boolean {
  return presentation?.open === true;
}

/** Portal hit-testing follows dismiss-start (`open`), not Gorhom's still-visible index. */
export function isSheetHostCapturingTaps(state: {
  open: boolean;
  sheetIndex: number;
}): boolean {
  return state.open;
}

export function isCatalogDrawerClosing(
  presentation: CatalogDrawerPresentation | null
): boolean {
  return presentation != null && !presentation.open;
}

/** Close-start is session-monotonic — a stale callback cannot close a replacement presentation. */
export function beginCatalogDrawerDismiss(
  presentation: CatalogDrawerPresentation | null,
  dismissedSessionId: number
): CatalogDrawerPresentation | null {
  if (presentation?.sessionId !== dismissedSessionId || !presentation.open) {
    return presentation;
  }

  return {
    ...presentation,
    open: false,
  };
}

export function finishCatalogDrawerDismiss(
  presentation: CatalogDrawerPresentation | null,
  dismissedSessionId: number
): CatalogDrawerPresentation | null {
  if (presentation?.sessionId !== dismissedSessionId || presentation.open) {
    return presentation;
  }

  return null;
}

export function simulateQuickReopen(
  presentation: CatalogDrawerPresentation,
  nextSessionId: number,
  nextVariantNumber: string
): CatalogDrawerPresentation {
  const dismissedSessionId = presentation.sessionId;
  const reopened = createCatalogDrawerPresentation(nextSessionId, nextVariantNumber);

  return finishCatalogDrawerDismiss(reopened, dismissedSessionId) ?? reopened;
}

/** Shared sheet host: parent intent, portal mount, and a per-open session for a fresh Gorhom instance. */
export type SheetHostState = {
  open: boolean;
  mounted: boolean;
  sessionId: number;
};

export function createSheetHostState(open: boolean): SheetHostState {
  return open
    ? { open: true, mounted: true, sessionId: 1 }
    : { open: false, mounted: false, sessionId: 0 };
}

/** Opening mounts a new session; closing keeps the host so Gorhom can play the exit animation. */
export function applySheetOpenIntent(
  state: SheetHostState,
  open: boolean
): SheetHostState {
  if (state.open === open) {
    return state;
  }
  if (open) {
    return { open: true, mounted: true, sessionId: state.sessionId + 1 };
  }
  return { ...state, open: false };
}

/** Close-start (swipe release, backdrop, back) only flips the parent for the live open session. */
export function shouldCommitSheetDismiss(
  state: SheetHostState,
  sessionId: number
): boolean {
  return state.open && state.sessionId === sessionId;
}

/** Gorhom settled closed or the fallback fired: unmount only a closed, matching session. */
export function finishSheetHostClose(
  state: SheetHostState,
  sessionId: number
): SheetHostState {
  if (state.open || !state.mounted || state.sessionId !== sessionId) {
    return state;
  }
  return { ...state, mounted: false };
}

/** Swipe release fires onAnimate(-1) at once; a forced close can skip Gorhom's settle callbacks. */
export function simulateSheetSwipeDismiss(
  state: SheetHostState,
  options: { gorhomSettles: boolean }
): SheetHostState {
  const { sessionId } = state;
  let next = state;
  if (shouldCommitSheetDismiss(next, sessionId)) {
    next = applySheetOpenIntent(next, false);
  }
  if (options.gorhomSettles) {
    next = finishSheetHostClose(next, sessionId);
  }
  return next;
}
