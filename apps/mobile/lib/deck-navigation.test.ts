import { describe, expect, mock, test } from 'bun:test';
import type { ImperativeRouter } from 'expo-router';
import {
  deckEditHref,
  deckViewHref,
  enterCreatedDeckEditor,
  isDeckEditMode,
  leaveDeckEditMode,
} from '@/lib/deck-navigation';

describe('deck-navigation', () => {
  test('view and edit hrefs', () => {
    expect(deckViewHref('abc')).toBe('/decks/abc');
    expect(deckEditHref('abc')).toBe('/decks/abc?mode=edit');
  });

  test('isDeckEditMode', () => {
    expect(isDeckEditMode('edit')).toBe(true);
    expect(isDeckEditMode(undefined)).toBe(false);
    expect(isDeckEditMode('view')).toBe(false);
    expect(isDeckEditMode(['edit'])).toBe(true);
    expect(isDeckEditMode(['view', 'edit'])).toBe(false);
  });

  test('leaveDeckEditMode dismisses one screen when possible (pop animation)', () => {
    const dismiss = mock(() => {});
    const replace = mock(() => {});
    leaveDeckEditMode(
      { canDismiss: () => true, dismiss, replace } as unknown as ImperativeRouter,
      'abc'
    );
    expect(dismiss).toHaveBeenCalledWith(1);
    expect(replace).not.toHaveBeenCalled();
  });

  test('leaveDeckEditMode replaces to viewer when nothing to dismiss', () => {
    const dismiss = mock(() => {});
    const replace = mock(() => {});
    leaveDeckEditMode(
      { canDismiss: () => false, dismiss, replace } as unknown as ImperativeRouter,
      'abc'
    );
    expect(dismiss).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/decks/abc');
  });

  test('enterCreatedDeckEditor stacks viewer under editor', () => {
    const replace = mock(() => {});
    const push = mock(() => {});
    enterCreatedDeckEditor({ replace, push } as unknown as ImperativeRouter, 'abc');
    expect(replace).toHaveBeenCalledWith('/decks/abc');
    expect(push).toHaveBeenCalledWith('/decks/abc?mode=edit');
  });
});
