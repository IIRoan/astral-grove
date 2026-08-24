/** Local draft for parent-bound text fields — while focused, ignore external churn so the caret stays put. */

export type FocusedTextDraftState = {
  draft: string;
  focused: boolean;
};

export function createFocusedTextDraftState(value: string): FocusedTextDraftState {
  return { draft: value, focused: false };
}

/** Parent/store value changed — adopt it only when the field is not focused. */
export function syncFocusedTextDraftState(
  state: FocusedTextDraftState,
  external: string
): FocusedTextDraftState {
  if (state.focused) return state;
  if (state.draft === external) return state;
  return { ...state, draft: external };
}

export function focusFocusedTextDraftState(
  state: FocusedTextDraftState
): FocusedTextDraftState {
  if (state.focused) return state;
  return { ...state, focused: true };
}

export function blurFocusedTextDraftState(
  state: FocusedTextDraftState
): FocusedTextDraftState {
  if (!state.focused) return state;
  return { ...state, focused: false };
}

export function changeFocusedTextDraftState(
  state: FocusedTextDraftState,
  text: string
): FocusedTextDraftState {
  if (state.draft === text && state.focused) return state;
  return { draft: text, focused: true };
}

/** Notify parent only when the draft string actually changed (skip clamp/same-string no-ops). */
export function shouldCommitFocusedTextDraft(previous: string, next: string): boolean {
  return previous !== next;
}
