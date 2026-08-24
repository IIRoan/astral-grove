import { describe, expect, test } from 'bun:test';
import {
  blurFocusedTextDraftState,
  changeFocusedTextDraftState,
  createFocusedTextDraftState,
  focusFocusedTextDraftState,
  shouldCommitFocusedTextDraft,
  syncFocusedTextDraftState,
} from '@/utils/focusedTextDraft';

describe('focusedTextDraft', () => {
  test('starts with the external value and unfocused', () => {
    expect(createFocusedTextDraftState('My Deck')).toEqual({
      draft: 'My Deck',
      focused: false,
    });
  });

  test('ignores external sync while focused so caret-stable drafts survive persist', () => {
    const focused = focusFocusedTextDraftState(
      createFocusedTextDraftState('Hello World')
    );
    const midEdit = changeFocusedTextDraftState(focused, 'Hello Wrld');

    // Parent re-renders with a stale or alternate store value mid-keystroke.
    expect(syncFocusedTextDraftState(midEdit, 'Hello World')).toEqual(midEdit);
    expect(syncFocusedTextDraftState(midEdit, 'Something else')).toEqual(midEdit);
  });

  test('adopts external value when not focused', () => {
    const idle = createFocusedTextDraftState('Old');
    expect(syncFocusedTextDraftState(idle, 'New')).toEqual({
      draft: 'New',
      focused: false,
    });
  });

  test('backspace mid-string keeps the draft without requiring focus flip', () => {
    const focused = focusFocusedTextDraftState(
      createFocusedTextDraftState('Hello World')
    );
    // Cursor was after "Hello" — delete the space.
    const afterBackspace = changeFocusedTextDraftState(focused, 'HelloWorld');
    expect(afterBackspace).toEqual({ draft: 'HelloWorld', focused: true });
    expect(syncFocusedTextDraftState(afterBackspace, 'Hello World')).toEqual(
      afterBackspace
    );
  });

  test('blur allows the next external sync to replace the draft', () => {
    const focused = changeFocusedTextDraftState(
      focusFocusedTextDraftState(createFocusedTextDraftState('A')),
      'AB'
    );
    const blurred = blurFocusedTextDraftState(focused);
    expect(blurred.focused).toBe(false);
    expect(syncFocusedTextDraftState(blurred, 'from-server')).toEqual({
      draft: 'from-server',
      focused: false,
    });
  });

  test('same-text change is a no-op for commit decisions', () => {
    expect(shouldCommitFocusedTextDraft('same', 'same')).toBe(false);
    expect(shouldCommitFocusedTextDraft('same', 'different')).toBe(true);
  });

  test('change marks focused even if focus event was missed', () => {
    const idle = createFocusedTextDraftState('');
    expect(changeFocusedTextDraftState(idle, 'x')).toEqual({
      draft: 'x',
      focused: true,
    });
  });
});
