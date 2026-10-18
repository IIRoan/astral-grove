import { describe, expect, test } from 'bun:test';
import { DeckSyncService } from '../../src/services/deck-sync.js';
import type { CardCacheService } from '../../src/services/card-cache.js';
import type { Database } from '../../src/db/client.js';

function createTransformTestHarness(options: {
  resolvedVariantIds?: Map<string, string>;
  resolveByUpstreamId?: (variantId: string, cardId: string) => Promise<string | null>;
  getByVariantNumber?: CardCacheService['getByVariantNumber'];
  resolveVariantNumbersFromUpstream?: CardCacheService['resolveVariantNumbersFromUpstream'];
}) {
  const db = {
    select: () => ({
      from: () => ({
        where: async () =>
          [...(options.resolvedVariantIds ?? new Map()).entries()].map(
            ([id, variantNumber]) => ({
              id,
              variantNumber,
            })
          ),
      }),
    }),
  } as unknown as Database;

  const cardCache = {
    getByVariantNumber:
      options.getByVariantNumber ??
      (async (variantNumber: string) => {
        throw new Error(`missing ${variantNumber}`);
      }),
    resolveVariantNumbersFromUpstream:
      options.resolveVariantNumbersFromUpstream ??
      (async (
        refs: Array<{ variantId: string; cardId: string }>,
        resolved: Map<string, string>
      ) => {
        if (options.resolveByUpstreamId) {
          for (const ref of refs) {
            const variantNumber = await options.resolveByUpstreamId(
              ref.variantId,
              ref.cardId
            );
            if (variantNumber) resolved.set(ref.variantId, variantNumber);
          }
        }
      }),
    resolveVariantNumberByUpstreamId: options.resolveByUpstreamId ?? (async () => null),
  } as unknown as CardCacheService;

  return new DeckSyncService(db, {} as never, cardCache);
}

describe('DeckSyncService.transformUpstreamDeckDetailToStoredDeckPayload', () => {
  test('preserves main deck counts when variants are missing from the catalog', async () => {
    const service = createTransformTestHarness({});

    const payload = await service.transformUpstreamDeckDetailToStoredDeckPayload({
      id: 'deck-1',
      name: 'Test deck',
      createdAt: '2026-01-01T00:00:00.000Z',
      legend: {
        id: 'legend-id',
        name: 'Legend',
        variantNumber: 'SFD-001',
        tags: [],
      },
      champions: [
        {
          cardId: 'champion-card',
          variantId: 'champion-variant',
          quantity: 1,
        },
      ],
      maindeck: [
        {
          cardId: 'card-a',
          variantId: 'missing-variant-a',
          quantity: 3,
        },
        {
          cardId: 'card-b',
          variantId: 'missing-variant-b',
          quantity: 2,
        },
      ],
      runes: [],
      battlefields: [],
      sideboard: [],
    });

    const mainCount = payload.mainDeck.reduce((sum, entry) => sum + entry.count, 0);
    expect(mainCount).toBe(5);
    expect(payload.champion?.name).toBe('Card not in catalog');
    expect(payload.syncWarnings?.length).toBeGreaterThan(0);
    expect(
      payload.syncWarnings?.some((warning) => warning.includes('3 card variants'))
    ).toBe(true);
  });

  test('uses resolved catalog cards when variant mappings exist', async () => {
    const service = createTransformTestHarness({
      resolvedVariantIds: new Map([['known-variant', 'SFD-010']]),
      getByVariantNumber: async (variantNumber: string) => ({
        detail: {
          id: 'card-known',
          name: 'Known Card',
          type: 'Spell',
          super: null,
          tags: [],
          colors: [{ id: 'c1', name: 'Calm' }],
          energy: 2,
          variants: [
            {
              id: 'known-variant',
              variantNumber,
              rarity: 'Common',
              variantType: 'Standard',
              imageUrl: 'https://cdn.piltoverarchive.com/cards/sfd-010.webp',
            },
          ],
        },
        source: 'cache',
        contentHash: 'hash',
      }),
    });

    const payload = await service.transformUpstreamDeckDetailToStoredDeckPayload({
      id: 'deck-2',
      name: 'Resolved deck',
      createdAt: '2026-01-01T00:00:00.000Z',
      maindeck: [
        {
          cardId: 'card-known',
          variantId: 'known-variant',
          quantity: 4,
        },
      ],
    });

    expect(payload.mainDeck).toHaveLength(1);
    expect(payload.mainDeck[0]?.card.name).toBe('Known Card');
    expect(payload.mainDeck[0]?.card.imageUrl).toBe(
      'https://cdn.piltoverarchive.com/cards/sfd-010.webp'
    );
    expect(payload.mainDeck[0]?.count).toBe(4);
    expect(payload.syncWarnings).toBeUndefined();
  });

  test('uses upstream legend image urls on imported summary fallbacks', async () => {
    const service = createTransformTestHarness({});

    const payload = await service.transformUpstreamDeckDetailToStoredDeckPayload({
      id: 'deck-legend-image',
      name: 'Legend image deck',
      createdAt: '2026-01-01T00:00:00.000Z',
      legend: {
        id: 'legend-id',
        name: 'Legend',
        variantNumber: 'SFD-001',
        tags: [],
        imageUrl: 'https://cdn.piltoverarchive.com/cards/sfd-001.webp',
      },
      champions: [],
      maindeck: [],
      runes: [],
      battlefields: [],
      sideboard: [],
    });

    expect(payload.legend?.imageUrl).toBe(
      'https://cdn.piltoverarchive.com/cards/sfd-001.webp'
    );
  });
});
