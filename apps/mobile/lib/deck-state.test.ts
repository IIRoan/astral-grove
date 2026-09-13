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

  test('keeps a richer version list when a newer list summary omits it', () => {
    const current = {
      ...createEmptyDeck('Current'),
      id: 'deck_1',
      versionId: 'dver_a',
      versionName: 'Current',
      updatedAt: 100,
      versions: [
        {
          id: 'dver_a',
          name: 'Current',
          createdAt: 1,
          updatedAt: 100,
          isActive: false,
        },
        {
          id: 'dver_b',
          name: 'versie2',
          createdAt: 200,
          updatedAt: 200,
          isActive: true,
        },
      ],
    };
    const incoming = {
      ...createEmptyDeck('From list'),
      id: 'deck_1',
      versionId: 'dver_b',
      versionName: 'versie2',
      updatedAt: 200,
    };
    const next = pickNewerDeckState(current, incoming);
    expect(next.name).toBe('From list');
    expect(next.versionId).toBe('dver_b');
    expect(next.versions).toHaveLength(2);
  });

  test('adopts server versions even when local card edits are newer', () => {
    const current = {
      ...createEmptyDeck('Local edits'),
      id: 'deck_1',
      versionId: 'dver_a',
      versionName: 'Current',
      updatedAt: 300,
      versions: [
        {
          id: 'dver_a',
          name: 'Current',
          createdAt: 1,
          updatedAt: 50,
          isActive: true,
        },
      ],
    };
    const incoming = {
      ...createEmptyDeck('From server'),
      id: 'deck_1',
      versionId: 'dver_a',
      versionName: 'Current',
      updatedAt: 50,
      versions: [
        {
          id: 'dver_a',
          name: 'Current',
          createdAt: 1,
          updatedAt: 50,
          isActive: false,
        },
        {
          id: 'dver_b',
          name: 'versie2',
          createdAt: 80,
          updatedAt: 80,
          isActive: true,
        },
      ],
    };
    const next = pickNewerDeckState(current, incoming);
    expect(next.name).toBe('Local edits');
    expect(next.updatedAt).toBe(300);
    expect(next.versions).toHaveLength(2);
    expect(next.versionId).toBe('dver_a');
  });
});
