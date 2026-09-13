import { describe, expect, test } from 'bun:test';
import { createEmptyDeck } from './deck-card';
import { pickNewerDeckState } from './deck-state';

describe('pickNewerDeckState', () => {
  test('replaces cache when the active version changes even if timestamps are older', () => {
    const current = {
      ...createEmptyDeck('Current'),
      id: 'deck_1',
      versionId: 'dver_a',
      updatedAt: 200,
    };
    const incoming = {
      ...createEmptyDeck('Incoming'),
      id: 'deck_1',
      versionId: 'dver_b',
      updatedAt: 50,
    };
    expect(pickNewerDeckState(current, incoming).versionId).toBe('dver_b');
  });

  test('keeps the newer payload when the version is unchanged', () => {
    const current = {
      ...createEmptyDeck('Current'),
      id: 'deck_1',
      versionId: 'dver_a',
      updatedAt: 200,
    };
    const incoming = {
      ...createEmptyDeck('Incoming'),
      id: 'deck_1',
      versionId: 'dver_a',
      updatedAt: 50,
    };
    expect(pickNewerDeckState(current, incoming).updatedAt).toBe(200);
  });
});
