import { describe, expect, test } from 'bun:test';
import {
  deckVersionSaveKey,
  formatVersionUpdatedAt,
  isSaveKeyForDeck,
} from './deck-version';

describe('deckVersionSaveKey', () => {
  test('scopes pending saves by version so siblings do not clobber', () => {
    expect(deckVersionSaveKey('deck_1', 'dver_a')).toBe('deck_1:dver_a');
    expect(deckVersionSaveKey('deck_1', 'dver_b')).toBe('deck_1:dver_b');
    expect(deckVersionSaveKey('deck_1', 'dver_a')).not.toBe(
      deckVersionSaveKey('deck_1', 'dver_b')
    );
  });

  test('falls back to the deck id when no version is present', () => {
    expect(deckVersionSaveKey('deck_1')).toBe('deck_1');
  });
});

describe('isSaveKeyForDeck', () => {
  test('matches deck-only and version-scoped keys for the same deck', () => {
    expect(isSaveKeyForDeck('deck_1', 'deck_1')).toBe(true);
    expect(isSaveKeyForDeck('deck_1:dver_a', 'deck_1')).toBe(true);
    expect(isSaveKeyForDeck('deck_2:dver_a', 'deck_1')).toBe(false);
    expect(isSaveKeyForDeck('deck_10:dver_a', 'deck_1')).toBe(false);
  });
});

describe('formatVersionUpdatedAt', () => {
  test('renders compact relative times', () => {
    const now = Date.parse('2026-09-13T10:00:00.000Z');
    expect(formatVersionUpdatedAt(now - 15_000, now)).toBe('just now');
    expect(formatVersionUpdatedAt(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatVersionUpdatedAt(now - 3 * 60 * 60_000, now)).toBe('3h ago');
    expect(formatVersionUpdatedAt(now - 2 * 24 * 60 * 60_000, now)).toBe('2d ago');
  });
});
