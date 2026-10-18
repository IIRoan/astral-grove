import { describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { createPricesRoutes } from '../../src/routes/prices.js';

function createPricesApp(overrides?: {
  list?: (query: { cardmarketId?: number; isFoil?: boolean }) => Promise<{
    rows: Array<{
      id: string;
      cardmarketId: number;
      isFoil: boolean;
      provider: 'cardmarket';
      currency: 'EUR';
      lowPrice: number | null;
      marketPrice: number | null;
      midPrice: number | null;
      highPrice: number | null;
      avg1Day: number | null;
      avg7Day: number | null;
      avg30Day: number | null;
      lastUpdated: string;
    }>;
    catalogHash: string;
    lastSyncedAt: string | null;
  }>;
  dailyHistory?: (query: {
    cardmarketId: number;
    isFoil?: boolean;
    days: number;
  }) => Promise<{
    rows: Array<{
      cardmarketId: number;
      isFoil: boolean;
      provider: 'cardmarket';
      currency: 'EUR';
      priceDate: string;
      lowPrice: number | null;
      marketPrice: number | null;
      midPrice: number | null;
      highPrice: number | null;
    }>;
  }>;
  statsBatch?: (
    items: Array<{
      variantNumber: string;
      isFoil?: boolean;
      targetPriceCents?: number | null;
    }>,
    days: number
  ) => Promise<
    Array<{
      variantNumber: string;
      cardmarketId: number | null;
      isFoil: boolean;
      currency: 'EUR';
      currentPrice: number | null;
      baselinePrice: number | null;
      minPrice: number | null;
      maxPrice: number | null;
      avgPrice: number | null;
      listingLow: number | null;
      changePercent: number | null;
      trend: 'up' | 'down' | 'flat';
      points: Array<{
        cardmarketId: number;
        isFoil: boolean;
        provider: 'cardmarket';
        currency: 'EUR';
        priceDate: string;
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
      }>;
      days: number;
      priceFilterLabel: string;
      priceSourceNote: string;
      targetPriceCents?: number | null;
      belowTarget?: boolean;
    }>
  >;
}) {
  const prices = {
    list:
      overrides?.list ??
      (async () => ({
        rows: [],
        catalogHash: 'prices-hash',
        lastSyncedAt: null,
      })),
    dailyHistory: overrides?.dailyHistory ?? (async () => ({ rows: [] })),
    statsBatch: overrides?.statsBatch ?? (async () => []),
  };

  return new Elysia().use(createPricesRoutes(prices as never, {} as never));
}

describe('prices routes', () => {
  test('GET /api/v1/prices parses boolean query values', async () => {
    const list = mock(async (query: { cardmarketId?: number; isFoil?: boolean }) => ({
      rows: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          cardmarketId: 10,
          isFoil: query.isFoil ?? false,
          provider: 'cardmarket' as const,
          currency: 'EUR' as const,
          lowPrice: 1.2,
          marketPrice: 1.5,
          midPrice: 1.4,
          highPrice: 1.8,
          avg1Day: 1.5,
          avg7Day: 1.4,
          avg30Day: 1.3,
          lastUpdated: '2026-08-24T09:21:00.000Z',
        },
      ],
      catalogHash: 'prices-hash',
      lastSyncedAt: '2026-08-24T09:21:00.000Z',
    }));

    const app = createPricesApp({ list });
    const response = await app.handle(
      new Request('http://localhost/api/v1/prices?isFoil=true')
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ isFoil: true });
  });

  test('GET /api/v1/prices/history returns an empty payload when no card is resolved', async () => {
    const dailyHistory = mock(async () => ({ rows: [] }));
    const app = createPricesApp({ dailyHistory });
    const response = await app.handle(
      new Request('http://localhost/api/v1/prices/history?days=7')
    );
    const body = (await response.json()) as {
      data: unknown[];
      meta: {
        cardmarketId: number | null;
        isFoil: boolean | null;
        days: number;
        rowCount: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [],
      meta: {
        cardmarketId: null,
        isFoil: null,
        days: 7,
        rowCount: 0,
      },
    });
    expect(dailyHistory).not.toHaveBeenCalled();
  });

  test('POST /api/v1/prices/stats/batch validates and forwards batch items', async () => {
    const statsBatch = mock(async (items, days) => [
      {
        variantNumber: items[0]?.variantNumber ?? 'OGN-001',
        cardmarketId: 10,
        isFoil: items[0]?.isFoil ?? false,
        currency: 'EUR' as const,
        currentPrice: 150,
        baselinePrice: 120,
        minPrice: 100,
        maxPrice: 180,
        avgPrice: 140,
        listingLow: 130,
        changePercent: 25,
        trend: 'up' as const,
        points: [],
        days,
        priceFilterLabel: '30d',
        priceSourceNote: 'market average',
        targetPriceCents: items[0]?.targetPriceCents,
        belowTarget: false,
      },
    ]);
    const app = createPricesApp({ statsBatch });

    const response = await app.handle(
      new Request('http://localhost/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ variantNumber: 'OGN-001', isFoil: true, targetPriceCents: 200 }],
          days: 14,
        }),
      })
    );
    const body = (await response.json()) as {
      meta: { days: number; rowCount: number };
    };

    expect(response.status).toBe(200);
    expect(statsBatch).toHaveBeenCalledWith(
      [{ variantNumber: 'OGN-001', isFoil: true, targetPriceCents: 200 }],
      14
    );
    expect(body.meta).toEqual({ days: 14, rowCount: 1 });
  });
});
