import { beforeEach, describe, expect, test } from 'bun:test';
import type { CollectionEntry } from '@/services/collectionService';
import { createMemoryAsyncStorage } from '../test/memory-async-storage';

const memoryStorage = createMemoryAsyncStorage();
memoryStorage.install();

const sampleEntry: CollectionEntry = {
  variantNumber: 'OGN-001',
  name: 'Vi Destructive',
  imageUrl: 'https://example.com/vi.jpg',
  setCode: 'OGN',
  rarity: 'Rare',
  type: 'Unit',
  variantLabel: 'Standard',
  isFoil: false,
  quantity: 2,
  addedAt: Date.now(),
  updatedAt: Date.now(),
};

const { clearPersistedCollection, persistCollection, readPersistedCollection } =
  await import('./collectionCacheService');

beforeEach(async () => {
  memoryStorage.clear();
  await clearPersistedCollection();
});

describe('collectionCacheService', () => {
  test('persistCollection round-trips entries', async () => {
    await persistCollection([sampleEntry]);

    const entries = await readPersistedCollection();
    expect(entries).toHaveLength(1);
    expect(entries?.[0]?.variantNumber).toBe('OGN-001');
    expect(entries?.[0]?.quantity).toBe(2);
  });

  test('readPersistedCollection returns null when cache is expired', async () => {
    const expiredPayload = {
      cachedAt: Date.now() - 25 * 60 * 60 * 1000,
      entries: [sampleEntry],
    };
    memoryStorage.store.set(
      'riftbound_collection_cache',
      JSON.stringify(expiredPayload)
    );

    expect(await readPersistedCollection()).toBeNull();
    expect(memoryStorage.store.has('riftbound_collection_cache')).toBe(false);
  });

  test('clearPersistedCollection removes stored cache', async () => {
    await persistCollection([sampleEntry]);
    await clearPersistedCollection();

    expect(await readPersistedCollection()).toBeNull();
  });
});
