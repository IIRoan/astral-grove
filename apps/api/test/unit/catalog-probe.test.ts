import { describe, expect, mock, test } from 'bun:test';
import type { PaLogicalCard } from '@riftbound/contracts';
import {
  accumulatePrintCounts,
  enrichFilterSnapshotWithPrintCounts,
  probeExpandedCatalog,
  snapshotHasPrintCounts,
} from '../../src/services/catalog-probe.js';
import type { PaClient } from '../../src/upstream/pa-client.js';

function logicalCard(id: string, variants: PaLogicalCard['variants']): PaLogicalCard {
  return {
    id,
    name: 'Test',
    type: 'Unit',
    super: null,
    description: '',
    energy: 1,
    might: 1,
    power: 1,
    tags: [],
    colors: [],
    variants,
  } as PaLogicalCard;
}

describe('snapshotHasPrintCounts', () => {
  test('returns true when any set has a positive print count', () => {
    expect(
      snapshotHasPrintCounts({
        colors: [],
        sets: [{ id: '1', name: 'Origins', count: 10, printCount: 0 }],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      })
    ).toBe(false);

    expect(
      snapshotHasPrintCounts({
        colors: [],
        sets: [{ id: '1', name: 'Origins', count: 10, printCount: 3 }],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      })
    ).toBe(true);
  });
});

describe('enrichFilterSnapshotWithPrintCounts', () => {
  test('falls back to logical set count when probe total is missing', () => {
    const enriched = enrichFilterSnapshotWithPrintCounts(
      {
        colors: [],
        sets: [{ id: '1', code: 'SFD', name: 'Spiritforged', count: 302 }],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      },
      {}
    );
    expect(enriched.sets[0]?.printCount).toBe(302);
  });
});

describe('probeExpandedCatalog', () => {
  test('deduplicates logical cards and sums collectible printings', async () => {
    const cardA = logicalCard('card-a', [
      {
        isCollectible: true,
        set: { prefix: 'OGN' },
      },
      {
        isCollectible: true,
        set: { prefix: 'OGN' },
      },
    ] as PaLogicalCard['variants']);
    const cardB = logicalCard('card-b', [
      {
        isCollectible: true,
        set: { prefix: 'SFD' },
      },
    ] as PaLogicalCard['variants']);

    const listCards = mock(async ({ page }: { page?: number }) => {
      if (page === 1) {
        return {
          data: [{ variantNumber: 'OGN-001' }, { variantNumber: 'OGN-001a' }],
          pagination: { hasNext: true },
        };
      }
      return {
        data: [{ variantNumber: 'SFD-001' }],
        pagination: { hasNext: false },
      };
    });
    const getCard = mock(async (variantNumber: string) => {
      if (variantNumber.startsWith('OGN')) return cardA;
      return cardB;
    });

    const pa = { listCards, getCard } as unknown as PaClient;
    const result = await probeExpandedCatalog(pa);

    expect(result.logicalCardCount).toBe(2);
    expect(result.catalogPrintTotal).toBe(3);
    expect(result.setPrintTotals).toEqual({ OGN: 2, SFD: 1 });
    expect(result.setFoilPrintTotals).toEqual({});
    expect(getCard).toHaveBeenCalledTimes(3);
  });

  test('keeps paging after a page that only repeats already-seen logical cards', async () => {
    const cardA = logicalCard('card-a', [
      { isCollectible: true, set: { prefix: 'OGN' } },
    ] as PaLogicalCard['variants']);
    const cardB = logicalCard('card-b', [
      { isCollectible: true, set: { prefix: 'RAD' } },
    ] as PaLogicalCard['variants']);

    const listCards = mock(async ({ page }: { page?: number }) => {
      if (page === 1) {
        return {
          data: [{ variantNumber: 'OGN-001' }],
          pagination: { hasNext: true },
        };
      }
      if (page === 2) {
        return {
          data: [{ variantNumber: 'OGN-001a' }],
          pagination: { hasNext: true },
        };
      }
      return {
        data: [{ variantNumber: 'RAD-038' }],
        pagination: { hasNext: false },
      };
    });
    const getCard = mock(async (variantNumber: string) => {
      if (variantNumber.startsWith('OGN')) return cardA;
      return cardB;
    });

    const result = await probeExpandedCatalog({
      listCards,
      getCard,
    } as unknown as PaClient);

    expect(result.logicalCardCount).toBe(2);
    expect(result.setPrintTotals).toEqual({ OGN: 1, RAD: 1 });
    expect(listCards).toHaveBeenCalledTimes(3);
  });

  test('counts foil printings separately when variant metadata is present', () => {
    const totals = new Map<string, number>();
    const foilTotals = new Map<string, number>();
    const added = accumulatePrintCounts(
      logicalCard('card-a', [
        {
          isCollectible: true,
          set: { prefix: 'OGN' },
          foilMode: 'both',
          variantNumber: 'OGN-001',
          variantLabel: 'Standard',
          variantType: 'Standard',
        },
        {
          isCollectible: true,
          set: { prefix: 'OGN' },
          foilMode: 'both',
          variantNumber: 'OGN-001-Foil',
          variantLabel: 'Foil',
          variantType: 'Standard',
        },
        {
          isCollectible: true,
          set: { prefix: 'OGN' },
          foilMode: 'foil_only',
          variantNumber: 'OGN-001-Nexus',
          variantLabel: 'Nexus Night Promo',
          variantType: 'Promo',
        },
      ] as PaLogicalCard['variants']),
      totals,
      foilTotals
    );
    expect(added).toBe(3);
    expect(totals.get('OGN')).toBe(3);
    expect(foilTotals.get('OGN')).toBe(2);
  });

  test('accumulatePrintCounts skips non-collectible variants', () => {
    const totals = new Map<string, number>();
    const added = accumulatePrintCounts(
      logicalCard('card-a', [
        { isCollectible: false, set: { prefix: 'OGN' } },
      ] as PaLogicalCard['variants']),
      totals
    );
    expect(added).toBe(0);
    expect(totals.size).toBe(0);
  });
});
