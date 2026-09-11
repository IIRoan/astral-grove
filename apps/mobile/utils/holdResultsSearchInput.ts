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

/** Draft while typing; committed only while focus-holding an empty draft. */
export function holdResultsActiveQuery(
  draft: string,
  committed: string,
  holdingFrom: string | null
): string {
  if (draft.length > 0) return draft;
  if (holdingFrom !== null) return committed;
  return '';
}

/** Parent committed value changed (history pick, external clear, etc.). */
export function syncHoldResultsSearchState(
  state: HoldResultsSearchState,
  committed: string
): HoldResultsSearchState {
  if (state.holdingFrom !== null && state.holdingFrom === committed) {
    return state;
  }
  // Focused editing: ignore lagged parent echoes so in-flight keystrokes are not overwritten.
  if (state.focused && state.holdingFrom === null) {
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
  if (state.focused) {
    return state;
  }
  if (state.draft.length === 0 && committed.length === 0) {
    return { ...state, focused: true };
  }
  return { draft: '', holdingFrom: committed, focused: true };
}

/** `/` while focused: empty the draft without committing or dropping focus. */
export function holdClearHoldResultsSearchState(
  committed: string
): HoldResultsSearchState {
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
