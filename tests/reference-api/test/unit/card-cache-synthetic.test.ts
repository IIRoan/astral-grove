import { describe, expect, test } from 'bun:test';
import { PaLogicalCard, type PaVariant } from '@riftbound/contracts';
import { CardCacheService } from '../../src/services/card-cache.js';
import type { Database } from '../../src/db/client.js';
import { PaApiError, type PaClient } from '../../src/upstream/pa-client.js';

const CARD_ID = '7596dc74-82bc-41ac-a25f-83f4b98ffb72';
const PARENT_ID = '0cd819d5-a03f-45d2-9e65-aec8ddae735e';
const SYNTHETIC_ID = '11111111-1111-4111-8111-111111111111';
const SET = {
  id: 'f57ec3c2-aebf-49b6-a6ef-cb8970e1897c',
  name: 'Vendetta',
  prefix: 'VEN',
} as const;

function parentVariant(): PaVariant {
  return {
    id: PARENT_ID,
    variantNumber: 'VEN-189',
    imageUrl: 'https://cdn.piltoverarchive.com/cards/VEN-189.webp',
    rarity: 'Showcase',
    variantType: 'Overnumbered',
    foilMode: 'foil_only',
    variantTypes: ['Overnumbered'],
    showInLibrary: true,
    isCollectible: true,
    variantLabel: 'Overnumbered',
    flavorText: null,
    artist: null,
    releaseDate: null,
    cardmarketId: 898141,
    tcgplayerId: null,
    parentVariantId: null,
    set: SET,
  };
}

function syntheticVariant(): PaVariant {
  return {
    ...parentVariant(),
    id: SYNTHETIC_ID,
    variantNumber: 'VEN-189*',
    variantLabel: 'Overnumbered Signed',
    variantTypes: ['Overnumbered', 'Signed'],
    cardmarketId: 898161,
    parentVariantId: PARENT_ID,
  };
}

function logicalCard(variants: PaVariant[]): PaLogicalCard {
  return PaLogicalCard.parse({
    id: CARD_ID,
    name: 'Akali, Rogue Assassin',
    type: 'Unit',
    super: 'Champion',
    description: '',
    energy: 4,
    might: 5,
    power: 2,
    tags: ['Akali'],
    colors: [{ id: '4583bc2e-da65-492f-97dc-4876988048d7', name: 'Calm' }],
    variants,
  });
}

function cachedDetail() {
  return {
    detail: {
      id: CARD_ID,
      name: 'Akali, Rogue Assassin',
      type: 'Unit',
      description: '',
      energy: 4,
      might: 5,
      power: 2,
      tags: [] as string[],
      colors: [] as Array<{ id: string; name: string }>,
      variants: [] as never[],
    },
    contentHash: 'cached-hash',
  };
}

function createService(options?: {
  getCard?: PaClient['getCard'];
  loadDetail?: () => Promise<ReturnType<typeof cachedDetail> | null>;
}) {
  const db = {
    query: {
      variants: { findFirst: async () => null },
      cards: { findFirst: async () => null },
    },
    update: () => ({ set: () => ({ where: async () => [] }) }),
  } as unknown as Database;

  const pa = {
    getCard:
      options?.getCard ??
      (async () => {
        throw new PaApiError('missing', 404);
      }),
  } as unknown as PaClient;

  const cards = new CardCacheService(
    db,
    pa,
    { getRowsForCardmarketIds: async () => [] } as never,
    {
      rewriteCard: (card: PaLogicalCard) => card,
      rewriteImageUrl: (url: string) => url,
    } as never
  );

  if (options?.loadDetail) {
    (
      cards as unknown as {
        loadCardDetailFromDb: typeof options.loadDetail;
      }
    ).loadCardDetailFromDb = options.loadDetail;
  }

  return cards;
}

describe('CardCacheService.mergeLocalOnlyVariants', () => {
  test('appends DB-only synthetic printings missing from upstreamRaw', () => {
    const cards = createService();
    const upstream = logicalCard([parentVariant()]);
    const merge = (
      cards as unknown as {
        mergeLocalOnlyVariants: (
          card: PaLogicalCard,
          dbVariants: Array<{
            variantNumber: string;
            cardmarketId: number | null;
            tcgplayerId: number | null;
            upstreamRaw: unknown;
          }>
        ) => PaLogicalCard;
      }
    ).mergeLocalOnlyVariants.bind(cards);

    const merged = merge(upstream, [
      {
        variantNumber: 'VEN-189',
        cardmarketId: 898141,
        tcgplayerId: null,
        upstreamRaw: parentVariant(),
      },
      {
        variantNumber: 'VEN-189*',
        cardmarketId: 898161,
        tcgplayerId: null,
        upstreamRaw: syntheticVariant(),
      },
    ]);

    expect(merged.variants.map((row) => row.variantNumber)).toEqual([
      'VEN-189',
      'VEN-189*',
    ]);
    expect(merged.variants[1]?.cardmarketId).toBe(898161);
    expect(merged.variants[1]?.variantLabel).toBe('Overnumbered Signed');
  });
});

describe('CardCacheService.mergeVariantMarketplaceIds', () => {
  test('prefers non-null upstream marketplace ids over DB backfill', () => {
    const cards = createService();
    const merge = (
      cards as unknown as {
        mergeVariantMarketplaceIds: (
          card: PaLogicalCard,
          dbVariants: Array<{
            variantNumber: string;
            cardmarketId: number | null;
            tcgplayerId: number | null;
          }>
        ) => PaLogicalCard;
      }
    ).mergeVariantMarketplaceIds.bind(cards);

    const upstream = logicalCard([
      {
        ...parentVariant(),
        cardmarketId: 111,
        tcgplayerId: 222,
      },
    ]);
    const merged = merge(upstream, [
      {
        variantNumber: 'VEN-189',
        cardmarketId: 898141,
        tcgplayerId: 999,
      },
    ]);

    expect(merged.variants[0]?.cardmarketId).toBe(111);
    expect(merged.variants[0]?.tcgplayerId).toBe(222);
  });

  test('keeps DB backfill when upstream marketplace ids are null', () => {
    const cards = createService();
    const merge = (
      cards as unknown as {
        mergeVariantMarketplaceIds: (
          card: PaLogicalCard,
          dbVariants: Array<{
            variantNumber: string;
            cardmarketId: number | null;
            tcgplayerId: number | null;
          }>
        ) => PaLogicalCard;
      }
    ).mergeVariantMarketplaceIds.bind(cards);

    const upstream = logicalCard([
      {
        ...parentVariant(),
        cardmarketId: null,
        tcgplayerId: null,
      },
    ]);
    const merged = merge(upstream, [
      {
        variantNumber: 'VEN-189',
        cardmarketId: 898141,
        tcgplayerId: null,
      },
    ]);

    expect(merged.variants[0]?.cardmarketId).toBe(898141);
  });
});

describe('CardCacheService.getByVariantNumber synthetic fallback', () => {
  test('serves cached synthetic * variant when PA returns 404', async () => {
    const cards = createService({
      getCard: async () => {
        throw new PaApiError('Piltover Archive API 404', 404);
      },
      loadDetail: async () => ({
        ...cachedDetail(),
        contentHash: 'synthetic-hash',
      }),
    });

    const result = await cards.getByVariantNumber('VEN-189*', { refresh: true });
    expect(result.source).toBe('cache');
    expect(result.contentHash).toBe('synthetic-hash');
  });

  test('rethrows non-404 upstream failures even when cache exists', async () => {
    const cards = createService({
      getCard: async () => {
        throw new PaApiError('Piltover Archive API 500', 500);
      },
      loadDetail: async () => cachedDetail(),
    });

    await expect(
      cards.getByVariantNumber('VEN-189', { refresh: true })
    ).rejects.toBeInstanceOf(PaApiError);
  });

  test('rethrows 404 for ordinary printings instead of serving stale cache', async () => {
    const cards = createService({
      getCard: async () => {
        throw new PaApiError('Piltover Archive API 404', 404);
      },
      loadDetail: async () => cachedDetail(),
    });

    await expect(
      cards.getByVariantNumber('VEN-189', { refresh: true })
    ).rejects.toBeInstanceOf(PaApiError);
  });
});
