import { describe, expect, test } from 'bun:test';
import { PaLogicalCard } from '@riftbound/contracts';
import { CardCacheService } from '../../src/services/card-cache.js';
import type { Database } from '../../src/db/client.js';
import type { PaClient } from '../../src/upstream/pa-client.js';

const VARIANT_ID = '0cd819d5-a03f-45d2-9e65-aec8ddae735e';
const CARD_ID = '7596dc74-82bc-41ac-a25f-83f4b98ffb72';
const VARIANT_NUMBER = 'OGS-011';

function createCardCacheHarness() {
  const upsertCalls: unknown[] = [];
  const db = {
    query: {
      variants: {
        findFirst: async () => null,
      },
      cards: {
        findFirst: async () => null,
      },
    },
  } as unknown as Database;

  const pa = {
    listCards: async ({ page }: { page?: number }) => ({
      data:
        page === 4
          ? [
              {
                id: VARIANT_ID,
                variantNumber: VARIANT_NUMBER,
                rarity: 'Common',
                variantType: 'Standard',
                foilMode: 'None',
                variantTypes: ['Standard'],
                imageUrl: 'https://example.com/ogs-011.webp',
                variantLabel: 'Standard',
                showInLibrary: true,
                isCollectible: true,
                set: {
                  id: '4583bc2e-da65-492f-97dc-4876988048d7',
                  name: 'OGS',
                  prefix: 'OGS',
                },
                card: { id: CARD_ID, name: 'Flash' },
              },
            ]
          : [],
      pagination: {
        total: 400,
        page: page ?? 1,
        limit: 100,
        totalPages: 4,
        hasNext: (page ?? 1) < 4,
        hasPrevious: (page ?? 1) > 1,
      },
      meta: { filters: {} },
    }),
    getCard: async (variantNumber: string) =>
      PaLogicalCard.parse({
        id: CARD_ID,
        name: 'Flash',
        type: 'Spell',
        super: null,
        description: '',
        energy: 1,
        might: 0,
        power: 0,
        tags: [],
        colors: [
          {
            id: '4583bc2e-da65-492f-97dc-4876988048d7',
            name: 'Calm',
          },
        ],
        variants: [
          {
            id: VARIANT_ID,
            variantNumber,
            rarity: 'Common',
            variantType: 'Standard',
            foilMode: 'None',
            variantTypes: ['Standard'],
            imageUrl: 'https://example.com/ogs-011.webp',
            variantLabel: 'Standard',
            showInLibrary: true,
            isCollectible: true,
            set: {
              id: '4583bc2e-da65-492f-97dc-4876988048d7',
              name: 'OGS',
              prefix: 'OGS',
            },
          },
        ],
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

  const originalUpsert = cards.upsertFromUpstream.bind(cards);
  cards.upsertFromUpstream = async (card) => {
    upsertCalls.push(card);
    return true;
  };

  return { cards, upsertCalls, originalUpsert };
}

describe('CardCacheService.resolveVariantNumberByUpstreamId', () => {
  test('discovers missing variants from upstream catalog list pages', async () => {
    const { cards, upsertCalls } = createCardCacheHarness();

    const variantNumber = await cards.resolveVariantNumberByUpstreamId(
      VARIANT_ID,
      CARD_ID
    );

    expect(variantNumber).toBe(VARIANT_NUMBER);
    expect(upsertCalls).toHaveLength(1);
    expect((upsertCalls[0] as PaLogicalCard).name).toBe('Flash');
  });
});

describe('CardCacheService.mapItem marketplace overlay', () => {
  test('keeps DB-backfilled cardmarketId when upstreamRaw still has null', () => {
    const { cards } = createCardCacheHarness();
    const logical = PaLogicalCard.parse({
      id: CARD_ID,
      name: 'Akali, Silent',
      type: 'Unit',
      super: 'Champion',
      description: '',
      energy: 4,
      might: 4,
      power: 1,
      tags: ['Akali'],
      colors: [
        {
          id: '4583bc2e-da65-492f-97dc-4876988048d7',
          name: 'Calm',
        },
      ],
      variants: [
        {
          id: VARIANT_ID,
          variantNumber: 'VEN-038',
          rarity: 'Rare',
          variantType: 'Standard',
          foilMode: 'foil_only',
          variantTypes: ['Standard'],
          imageUrl: 'https://example.com/ven-038.webp',
          variantLabel: 'Standard',
          showInLibrary: true,
          isCollectible: true,
          cardmarketId: null,
          set: {
            id: 'f57ec3c2-aebf-49b6-a6ef-cb8970e1897c',
            name: 'Vendetta',
            prefix: 'VEN',
          },
        },
      ],
    });

    const overlaid = {
      ...logical.variants[0]!,
      cardmarketId: 897976,
    };

    const priceRows = [
      {
        id: 'p1',
        cardmarketId: 897976,
        tcgPlayerId: null,
        provider: 'cardmarket' as const,
        isFoil: true,
        currency: 'EUR' as const,
        lowPrice: '0.20',
        marketPrice: '0.38',
        midPrice: '1.99',
        highPrice: null,
        directLowPrice: null,
        avg1Day: '0.65',
        avg7Day: '0.77',
        avg30Day: '0.87',
        lastUpdated: '2026-08-05T00:00:00.000Z',
      },
    ];

    // Private helper — list/index mapping must not discard DB overlays.
    const item = (
      cards as unknown as {
        mapItem: typeof cards extends never
          ? never
          : (
              card: PaLogicalCard,
              variant: (typeof logical.variants)[0],
              priceRows: typeof priceRows
            ) => {
              cardmarketId: number | null;
              priceEur: { market: number | null } | null;
            };
      }
    ).mapItem(logical, overlaid, priceRows);

    expect(item.cardmarketId).toBe(897976);
    expect(item.priceEur?.market).toBe(0.38);
  });
});
