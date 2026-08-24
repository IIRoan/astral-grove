import { describe, expect, it } from 'bun:test';
import type { CollectionEntry } from '@/services/collectionService';
import {
  catalogCardTotalFromTypes,
  computeRarityBreakdown,
  computeTypeBreakdown,
  countUniqueCardNames,
  countUniqueVariants,
  mergeSetStats,
  sumCollectionCopies,
} from './collectionStats';

function entry(
  overrides: Partial<CollectionEntry> & Pick<CollectionEntry, 'variantNumber' | 'name'>
): CollectionEntry {
  return {
    imageUrl: '',
    setCode: 'OGN',
    rarity: 'Common',
    variantLabel: 'Standard',
    isFoil: false,
    quantity: 1,
    addedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('collectionStats', () => {
  it('counts copies, unique names, and unique variants separately', () => {
    const collection = [
      entry({ variantNumber: 'OGN-001', name: 'Card A', quantity: 4 }),
      entry({
        variantNumber: 'OGN-001',
        name: 'Card A',
        quantity: 2,
        condition: 'near_mint',
      }),
      entry({ variantNumber: 'OGN-002', name: 'Card B', quantity: 3 }),
    ];

    expect(sumCollectionCopies(collection)).toBe(9);
    expect(countUniqueCardNames(collection)).toBe(2);
    expect(countUniqueVariants(collection)).toBe(2);
  });

  it('breaks down types and rarities by unique card names', () => {
    const collection = [
      entry({
        variantNumber: 'OGN-001',
        name: 'Unit A',
        type: 'Unit',
        rarity: 'Common',
        quantity: 5,
      }),
      entry({
        variantNumber: 'OGN-001a',
        name: 'Unit A',
        type: 'Unit',
        rarity: 'Common',
        quantity: 1,
      }),
      entry({
        variantNumber: 'OGN-002',
        name: 'Spell B',
        type: 'Spell',
        rarity: 'Rare',
        quantity: 2,
      }),
    ];

    expect(
      computeTypeBreakdown(collection, [
        { name: 'Unit', count: 10 },
        { name: 'Spell', count: 5 },
      ])
    ).toEqual([
      { name: 'Unit', owned: 1, total: 10 },
      { name: 'Spell', owned: 1, total: 5 },
    ]);

    expect(
      computeRarityBreakdown(collection, [
        { name: 'Common', count: 8 },
        { name: 'Rare', count: 4 },
      ])
    ).toEqual([
      { name: 'Common', owned: 1, total: 8 },
      { name: 'Rare', owned: 1, total: 4 },
    ]);
  });

  it('derives catalog card total from filter types', () => {
    expect(
      catalogCardTotalFromTypes([
        { name: 'Unit', count: 501 },
        { name: 'Spell', count: 192 },
        { name: 'Card', count: 99 },
      ])
    ).toBe(693);
  });

  it('lists sets from the API snapshot, not a hardcoded catalog', () => {
    const collection = [
      entry({ variantNumber: 'OGN-001', name: 'Card A', setCode: 'OGN', quantity: 1 }),
      entry({
        variantNumber: 'VEN-001',
        name: 'New Card',
        setCode: 'VEN',
        quantity: 1,
      }),
    ];

    const merged = mergeSetStats(
      collection,
      [
        { code: 'VEN', name: 'Vendetta', count: 30 },
        { code: 'OGN', name: 'Origins', count: 354 },
      ],
      (code) => (code === 'OGN' ? { name: 'Origins', released: 'Oct 2025' } : undefined)
    );

    expect(merged.map((set) => set.code)).toEqual(['VEN', 'OGN']);
    expect(merged[0]).toMatchObject({
      code: 'VEN',
      name: 'Vendetta',
      total: 30,
      owned: 1,
      nonFoilOwned: 1,
      foilOwned: 0,
    });
  });

  it('includes owned sets missing from the API snapshot', () => {
    const merged = mergeSetStats(
      [
        entry({
          variantNumber: 'VEN-001',
          name: 'New Card',
          setCode: 'VEN',
          quantity: 2,
        }),
      ],
      [{ code: 'OGN', name: 'Origins', count: 354 }]
    );

    expect(merged.map((set) => set.code)).toEqual(['OGN', 'VEN']);
    expect(merged[1]).toMatchObject({ code: 'VEN', name: 'VEN', owned: 1, total: 1 });
  });

  it('splits non-foil and foil ownership with separate denominators', () => {
    const collection = [
      entry({
        variantNumber: 'OGN-001',
        name: 'Card A',
        setCode: 'OGN',
        isFoil: false,
      }),
      entry({
        variantNumber: 'OGN-001-Foil',
        name: 'Card A',
        setCode: 'OGN',
        isFoil: true,
      }),
      entry({
        variantNumber: 'OGN-002',
        name: 'Card B',
        setCode: 'OGN',
        isFoil: false,
      }),
    ];

    const [origins] = mergeSetStats(collection, [
      { code: 'OGN', name: 'Origins', count: 544, foilCount: 172 },
    ]);

    expect(origins).toMatchObject({
      owned: 3,
      nonFoilOwned: 2,
      foilOwned: 1,
      nonFoilTotal: 372,
      foilTotal: 172,
    });
  });
});
