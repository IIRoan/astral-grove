import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import type { CollectionEntry } from '@/services/collectionService';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import {
  applyCollectionQuantity,
  getOwnershipRecord,
} from '@/lib/collection-optimistic-cache';
import {
  ownershipMapFromCollection,
  ownershipMapFromRecord,
  preferCollectionOwnership,
} from '@/utils/collectionOwnership';

describe('applyCollectionQuantity', () => {
  test('updates ownership immediately when list row is missing and seed is absent', () => {
    const client = new QueryClient();
    client.setQueryData(collectionQueryKeys.all, []);

    applyCollectionQuantity(client, 'OGN-042', 2, undefined, false);

    expect(getOwnershipRecord(client)['OGN-042::std']).toBe(2);
    expect(getOwnershipRecord(client)['OGN-042']).toBe(2);
    expect(client.getQueryData(collectionQueryKeys.all)).toEqual([]);
  });

  test('updates list and ownership when seed is provided for a new row', () => {
    const client = new QueryClient();
    client.setQueryData(collectionQueryKeys.all, []);

    applyCollectionQuantity(
      client,
      'OGN-001',
      1,
      {
        name: 'Vi',
        imageUrl: 'https://example.com/vi.jpg',
        setCode: 'OGN',
        rarity: 'Rare',
        type: 'Unit',
        variantLabel: 'Standard',
        isFoil: false,
      },
      false
    );

    const all = client.getQueryData<CollectionEntry[]>(collectionQueryKeys.all);
    expect(all).toHaveLength(1);
    expect(all?.[0]?.quantity).toBe(1);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(1);
  });

  test('search merge shows new qty immediately after increment (catalog path)', () => {
    const client = new QueryClient();
    const row: CollectionEntry = {
      variantNumber: 'OGN-001',
      name: 'Vi',
      imageUrl: 'https://example.com/vi.jpg',
      setCode: 'OGN',
      rarity: 'Rare',
      type: 'Unit',
      variantLabel: 'Standard',
      isFoil: false,
      quantity: 1,
      addedAt: 1,
      updatedAt: 1,
    };
    client.setQueryData(collectionQueryKeys.all, [row]);
    client.setQueryData(collectionQueryKeys.ownershipRoot, {
      'OGN-001': 1,
      'OGN-001::std': 1,
    });

    applyCollectionQuantity(client, 'OGN-001', 2, undefined, false);

    const entries = client.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
    const fromCollection = ownershipMapFromCollection(entries);
    const fetched = ownershipMapFromRecord(getOwnershipRecord(client));
    const merged = preferCollectionOwnership(fetched, fromCollection);

    expect(merged.get('OGN-001')?.quantity).toBe(2);
    expect(merged.get('OGN-001::std')?.quantity).toBe(2);
  });
});
