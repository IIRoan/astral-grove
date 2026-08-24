export type HoldResultsSearchState = {
  draft: string;
  /** Committed query captured on focus-clear; null when not holding. */
  holdingFrom: string | null;
  /** True while the native field owns focus — blocks redundant parent sync. */
  focused: boolean;
};

export function createHoldResultsSearchState(
  committed: string
): HoldResultsSearchState {
  return { draft: committed, holdingFrom: null, focused: false };
}

/** Parent committed value changed (history pick, external clear, etc.). */
export function syncHoldResultsSearchState(
  state: HoldResultsSearchState,
  committed: string
): HoldResultsSearchState {
  if (state.holdingFrom !== null && state.holdingFrom === committed) {
    return state;
  }
  // While focused, ignore parent echoes of the same committed value (avoids caret reset on web).
  if (state.focused && state.holdingFrom === null && state.draft === committed) {
    return state;
  }
  if (state.draft === committed && state.holdingFrom === null) {
    return state;
  }
  return { draft: committed, holdingFrom: null, focused: state.focused };
}

export function focusHoldResultsSearchState(
  state: HoldResultsSearchState,
  committed: string
): HoldResultsSearchState {
  if (state.draft.length === 0 && committed.length === 0) {
    return { ...state, focused: true };
  }
  return { draft: '', holdingFrom: committed, focused: true };
}

export function blurHoldResultsSearchState(
  state: HoldResultsSearchState
): HoldResultsSearchState {
  if (state.holdingFrom === null) {
    return { ...state, focused: false };
  }
  if (state.draft.length === 0) {
    return { draft: state.holdingFrom, holdingFrom: null, focused: false };
  }
  return { ...state, holdingFrom: null, focused: false };
}

export function changeHoldResultsSearchState(text: string): HoldResultsSearchState {
  return { draft: text, holdingFrom: null, focused: true };
}

export function clearHoldResultsSearchState(): HoldResultsSearchState {
  return { draft: '', holdingFrom: null, focused: false };
}
