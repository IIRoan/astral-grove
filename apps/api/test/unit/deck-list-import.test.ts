import { describe, expect, test } from 'bun:test';
import { DeckSyncService } from '../../src/services/deck-sync.js';

const upstreamListFixture = {
  data: [
    {
      id: 'deck-alpha',
      name: 'Alpha Deck',
      description: 'First test deck',
      authorName: 'Test Author',
      views: 1200,
      likes: 14,
      isLegal: true,
      createdAt: '2026-06-21T23:06:49.975Z',
      editedAt: '2026-06-25T01:22:05.612Z',
      legend: {
        id: 'legend-1',
        name: 'Master Yi, Wuju Bladesman',
        variantNumber: 'OGS-019',
        tags: [],
        colors: [{ name: 'Body' }],
      },
      sets: [{ prefix: 'OGS', name: 'Proving Grounds' }],
      contentFlags: { hasVideo: true, hasGuide: false, hasMatchups: true },
    },
    {
      id: 'deck-beta',
      name: 'Beta Deck',
      description: null,
      createdAt: '2026-06-14T21:14:51.322Z',
      editedAt: '2026-06-18T20:17:53.353Z',
      legend: {
        id: 'legend-2',
        name: 'Viktor, Herald of the Arcane',
        variantNumber: 'OGN-265',
        tags: [],
      },
    },
    {
      id: 'deck-owned-skip',
      name: 'Already owned upstream deck',
      description: null,
      createdAt: '2026-06-14T21:14:51.322Z',
      legend: null,
    },
  ],
};

function createDeckSyncForTest() {
  let listCalls = 0;
  let detailCalls = 0;

  const pa = {
    listDecks: async () => {
      listCalls += 1;
      return upstreamListFixture;
    },
    getDeck: async () => {
      detailCalls += 1;
      throw new Error('getDeck should not be called for list summaries');
    },
  };

  const cardCache = {
    getByVariantNumber: async (variantNumber: string) => ({
      detail: {
        id: `card-${variantNumber}`,
        name: `Legend ${variantNumber}`,
        type: 'Unit',
        super: 'Champion',
        tags: [],
        colors: [{ name: 'Body' }],
        energy: 0,
        variants: [
          {
            variantNumber,
            rarity: 'Rare',
            variantType: 'Standard',
          },
        ],
      },
    }),
  };

  const deckSync = new DeckSyncService({} as never, pa as never, cardCache as never);

  return {
    deckSync,
    metrics: () => ({ listCalls, detailCalls }),
  };
}

describe('DeckSyncService.listImportedDeckSummaries', () => {
  test('uses upstream list only and skips owned upstream ids', async () => {
    const { deckSync, metrics } = createDeckSyncForTest();

    const items = await deckSync.listImportedDeckSummaries({
      skipIds: new Set(['deck-owned-skip']),
    });

    expect(metrics().listCalls).toBe(1);
    expect(metrics().detailCalls).toBe(0);
    expect(items.items).toHaveLength(2);
    expect(items.items.map((item) => item.id)).toEqual(['deck-alpha', 'deck-beta']);
    expect(
      items.items.every((item) => item.source === 'imported' && item.readOnly)
    ).toBe(true);
    expect(items.items[0]?.legend?.variantNumber).toBe('OGS-019');
    expect(items.items[0]?.mainDeck).toEqual([]);
    expect(items.items[0]?.authorName).toBe('Test Author');
    expect(items.items[0]?.views).toBe(1200);
    expect(items.items[0]?.likes).toBe(14);
    expect(items.items[0]?.isLegal).toBe(true);
    expect(items.items[0]?.setPrefixes).toEqual(['OGS']);
    expect(items.items[0]?.hasVideo).toBe(true);
    expect(items.items[0]?.hasMatchups).toBe(true);
  });

  test('forwards search query to upstream list', async () => {
    let upstreamQuery: Record<string, unknown> | undefined;
    const pa = {
      listDecks: async (params?: Record<string, unknown>) => {
        upstreamQuery = params;
        return upstreamListFixture;
      },
      getDeck: async () => {
        throw new Error('getDeck should not be called for list summaries');
      },
    };
    const cardCache = {
      getByVariantNumber: async (variantNumber: string) => ({
        detail: {
          id: `card-${variantNumber}`,
          name: `Legend ${variantNumber}`,
          type: 'Unit',
          super: 'Champion',
          tags: [],
          colors: [{ name: 'Body' }],
          energy: 0,
          variants: [{ variantNumber, rarity: 'Rare', variantType: 'Standard' }],
        },
      }),
    };
    const testSync = new DeckSyncService({} as never, pa as never, cardCache as never);

    const result = await testSync.listImportedDeckSummaries({
      skipIds: new Set(),
      query: {
        q: 'viktor',
        page: 1,
        limit: 25,
        sort: 'trending',
        dir: 'desc',
        source: 'imported',
      },
    });

    expect(upstreamQuery?.q).toBe('viktor');
    expect(result.items).toHaveLength(3);
  });

  test('enriches browse previews when preview=true', async () => {
    const { deckSync } = createDeckSyncForTest();
    let detailCalls = 0;
    const syncInternals = deckSync as unknown as {
      getUpstreamDeckDetail: (deckId: string) => Promise<{ id: string }>;
      transformUpstreamDeckDetailToStoredDeckPayload: (upstream: {
        id: string;
      }) => Promise<{
        champion: null;
        legend: null;
        mainDeck: Array<{ card: { name: string }; count: number }>;
      }>;
    };
    syncInternals.getUpstreamDeckDetail = async (deckId: string) => {
      detailCalls += 1;
      return { id: deckId };
    };
    syncInternals.transformUpstreamDeckDetailToStoredDeckPayload = async () => ({
      champion: null,
      legend: null,
      mainDeck: [{ card: { name: 'Preview Card' }, count: 3 }],
    });

    const result = await deckSync.listImportedDeckSummaries({
      skipIds: new Set(['deck-owned-skip']),
      query: {
        page: 1,
        limit: 25,
        sort: 'trending',
        dir: 'desc',
        source: 'imported',
        preview: true,
      },
    });

    expect(detailCalls).toBe(2);
    expect(result.items[0]?.mainDeck).toHaveLength(1);
    expect(result.items[0]?.mainDeck[0]?.card.name).toBe('Preview Card');
  });

  test('reuses legend card cache across list entries', async () => {
    const { deckSync } = createDeckSyncForTest();
    let legendLookups = 0;
    const syncInternals = deckSync as unknown as {
      cardCache: { getByVariantNumber: (variantNumber: string) => Promise<unknown> };
    };
    const base = syncInternals.cardCache.getByVariantNumber.bind(
      syncInternals.cardCache
    );
    syncInternals.cardCache.getByVariantNumber = async (variantNumber: string) => {
      legendLookups += 1;
      return base(variantNumber);
    };

    const fixtureWithDuplicateLegend = {
      data: [
        upstreamListFixture.data[0],
        {
          ...upstreamListFixture.data[0],
          id: 'deck-alpha-copy',
          name: 'Alpha Copy',
        },
      ],
    };

    const pa = {
      listDecks: async () => fixtureWithDuplicateLegend,
      getDeck: async () => {
        throw new Error('unexpected detail fetch');
      },
    };
    const testSync = new DeckSyncService(
      {} as never,
      pa as never,
      syncInternals.cardCache as never
    );

    const result = await testSync.listImportedDeckSummaries({ skipIds: new Set() });

    expect(result.items).toHaveLength(2);
    expect(legendLookups).toBe(1);
    expect(result.items[0]?.legend).toEqual(result.items[1]?.legend);
  });
});

describe('imported deck list item shape', () => {
  test('summary items are valid list payloads without main deck cards', async () => {
    const { deckSync } = createDeckSyncForTest();
    const result = await deckSync.listImportedDeckSummaries({ skipIds: new Set() });

    for (const item of result.items) {
      expect(item.mainDeck).toEqual([]);
      expect(item.runes).toEqual([]);
      expect(item.battlefields).toEqual([]);
      expect(item.sideboard).toEqual([]);
      expect(item.champion).toBeNull();
      expect(typeof item.createdAt).toBe('number');
      expect(typeof item.updatedAt).toBe('number');
    }
  });
});
