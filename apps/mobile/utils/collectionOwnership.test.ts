import { describe, expect, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import type { CollectionEntry } from '@/services/collectionService';
import {
  collectVariantNumbers,
  mergeOwnershipFromCollection,
  mergeOwnershipRecords,
  ownershipMapFromRecord,
  ownershipRecordFromCollection,
  ownershipRecordFromQuantityRows,
  preferCollectionOwnership,
} from '@/utils/collectionOwnership';

const sampleCard = {
  variantNumber: 'OGN-001',
  printings: [{ variantNumber: 'OGN-001' }, { variantNumber: 'OGN-001a' }],
} as CardListItem;

const sampleEntries: CollectionEntry[] = [
  {
    variantNumber: 'OGN-001',
    name: 'Vi',
    imageUrl: 'https://example.com/vi.jpg',
    setCode: 'OGN',
    rarity: 'Rare',
    type: 'Unit',
    variantLabel: 'Standard',
    isFoil: false,
    quantity: 2,
    addedAt: 1,
    updatedAt: 1,
  },
  {
    variantNumber: 'OGN-002',
    name: 'Jinx',
    imageUrl: 'https://example.com/jinx.jpg',
    setCode: 'OGN',
    rarity: 'Rare',
    type: 'Unit',
    variantLabel: 'Standard',
    isFoil: false,
    quantity: 0,
    addedAt: 1,
    updatedAt: 1,
  },
];

describe('collectionOwnership', () => {
  test('collectVariantNumbers gathers printings and extras', () => {
    expect(collectVariantNumbers([sampleCard], ['OGN-002'])).toEqual([
      'OGN-001',
      'OGN-001a',
      'OGN-002',
    ]);
  });

  test('collectVariantNumbers deduplicates extras', () => {
    expect(collectVariantNumbers([sampleCard], ['OGN-001', 'OGN-001'])).toEqual([
      'OGN-001',
      'OGN-001a',
    ]);
  });

  test('ownershipRecordFromCollection skips zero quantities', () => {
    expect(ownershipRecordFromCollection(sampleEntries)).toEqual({
      'OGN-001': 2,
      'OGN-001::std': 2,
    });
  });

  test('ownershipMapFromRecord omits zero quantities', () => {
    const map = ownershipMapFromRecord({ 'OGN-001': 2, 'OGN-002': 0 });
    expect(map.get('OGN-001')?.quantity).toBe(2);
    expect(map.has('OGN-002')).toBe(false);
  });

  test('mergeOwnershipRecords updates and keeps known-zero quantities', () => {
    expect(
      mergeOwnershipRecords(
        { 'OGN-001': 1, 'OGN-002': 2 },
        { 'OGN-001': 3, 'OGN-002': 0 }
      )
    ).toEqual({ 'OGN-001': 3, 'OGN-002': 0 });
  });

  test('mergeOwnershipRecords adds new variants', () => {
    expect(mergeOwnershipRecords({ 'OGN-001': 1 }, { 'OGN-003': 4 })).toEqual({
      'OGN-001': 1,
      'OGN-003': 4,
    });
  });

  test('mergeOwnershipFromCollection preserves known zeros and clears removed owned', () => {
    expect(
      mergeOwnershipFromCollection(
        { 'OGN-001': 2, 'OGN-001::std': 2, 'OGN-099': 0, 'OGN-050': 1 },
        [{ ...sampleEntries[0]!, variantNumber: 'OGN-001', quantity: 3 }]
      )
    ).toEqual({
      'OGN-001': 3,
      'OGN-001::std': 3,
      'OGN-099': 0,
      'OGN-050': 0,
    });
  });

  test('preferCollectionOwnership lets collection win over stale ownership', () => {
    const ownership = ownershipMapFromRecord({ 'OGN-001': 1, 'OGN-002': 2 });
    const fromCollection = ownershipMapFromRecord({ 'OGN-001': 3 });
    const merged = preferCollectionOwnership(ownership, fromCollection);
    expect(merged.get('OGN-001')?.quantity).toBe(3);
    expect(merged.get('OGN-002')?.quantity).toBe(2);
  });

  test('ownership map from collection seeds list tiles before detail opens', () => {
    const record = ownershipRecordFromCollection([
      {
        ...sampleEntries[0]!,
        variantNumber: 'OGN-015',
        quantity: 2,
      },
      {
        ...sampleEntries[0]!,
        variantNumber: 'OGN-015-Foil',
        isFoil: true,
        quantity: 1,
      },
    ]);
    const map = ownershipMapFromRecord(record);
    expect(map.get('OGN-015')?.quantity).toBe(2);
    expect(map.get('OGN-015::std')?.quantity).toBe(2);
    expect(map.get('OGN-015-Foil')?.quantity).toBe(1);
    expect(map.get('OGN-015-Foil::foil')?.quantity).toBe(1);
    expect(map.size).toBe(4);
  });

  test('ownershipRecordFromQuantityRows keeps finishes separate and aggregates VN totals', () => {
    const record = ownershipRecordFromQuantityRows([
      { variantNumber: 'VEN-074', isFoil: false, quantity: 2 },
      { variantNumber: 'VEN-074', isFoil: true, quantity: 1 },
    ]);
    expect(record).toEqual({
      'VEN-074::std': 2,
      'VEN-074::foil': 1,
      'VEN-074': 3,
    });
  });
});
