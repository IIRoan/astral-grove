import { beforeEach, describe, expect, test } from 'bun:test';
import { createEmptyDeck } from '@/lib/deck-card';
import { createMemoryAsyncStorage } from '../test/memory-async-storage';

const memoryStorage = createMemoryAsyncStorage();
memoryStorage.install();

const { clearPersistedOwnedDecks, persistOwnedDecks, readPersistedOwnedDecks } =
  await import('./deckCacheService');

beforeEach(async () => {
  memoryStorage.clear();
  await clearPersistedOwnedDecks();
});

describe('deckCacheService', () => {
  test('persistOwnedDecks round-trips Map sections', async () => {
    const deck = createEmptyDeck('Cache Test');
    deck.mainDeck.set('Vi', {
      card: {
        cardId: 'c1',
        variantNumber: 'OGN-001',
        name: 'Vi',
        type: 'Unit',
        super: null,
        tags: [],
        colors: ['Fury'],
        energy: 2,
        setCode: 'OGN',
        rarity: 'Rare',
        variantType: 'Standard',
        isSignature: false,
      },
      count: 3,
    });

    await persistOwnedDecks([deck]);
    const restored = await readPersistedOwnedDecks();

    expect(restored).toHaveLength(1);
    expect(restored?.[0]?.name).toBe('Cache Test');
    expect(restored?.[0]?.mainDeck.get('Vi')?.count).toBe(3);
  });

  test('readPersistedOwnedDecks returns null when cache is expired', async () => {
    const expiredPayload = {
      cachedAt: Date.now() - 25 * 60 * 60 * 1000,
      decks: [],
    };
    memoryStorage.store.set(
      'riftbound_owned_decks_cache',
      JSON.stringify(expiredPayload)
    );

    expect(await readPersistedOwnedDecks()).toBeNull();
    expect(memoryStorage.store.has('riftbound_owned_decks_cache')).toBe(false);
  });

  test('clearPersistedOwnedDecks removes stored cache', async () => {
    await persistOwnedDecks([createEmptyDeck('Gone')]);
    await clearPersistedOwnedDecks();
    expect(await readPersistedOwnedDecks()).toBeNull();
  });
});
