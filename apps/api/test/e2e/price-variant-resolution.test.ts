import { describe, expect, test, setDefaultTimeout } from 'bun:test';
import {
  CardDetailResponse,
  CardsListResponse,
  PriceHistoryResponse,
  PriceStatsBatchResponse,
  PricesListResponse,
  SyncPricesResponse,
} from '@riftbound/contracts';
import { adminAuthHeaders, apiJson, syncPricesForE2E } from './support.js';

setDefaultTimeout(300_000);

function hasDisplayPrice(item: {
  priceEur: { market: number | null; low: number | null } | null;
}): boolean {
  const price = item.priceEur;
  if (price == null) return false;
  return (price.market != null && price.market > 0) || price.low != null;
}

describe('Cardmarket price coverage (e2e)', () => {
  test('synced catalog rows expose list prices, stats, and daily history', async () => {
    await syncPricesForE2E();

    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?q=OGN-001&limit=10&page=1')
    );
    const standard = list.data.find((row) => row.variantNumber === 'OGN-001');
    expect(standard).toBeTruthy();
    expect(hasDisplayPrice(standard!)).toBe(true);

    const stats = PriceStatsBatchResponse.parse(
      await apiJson<unknown>('/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          items: [{ variantNumber: standard!.variantNumber }],
        }),
      })
    );
    const row = stats.data[0];
    expect(row?.variantNumber).toBe('OGN-001');
    expect(row?.cardmarketId).not.toBeNull();
    expect(row?.currentPrice).not.toBeNull();
    expect(row?.points.length).toBeGreaterThan(0);

    const history = PriceHistoryResponse.parse(
      await apiJson<unknown>(
        `/api/v1/prices/history?variantNumber=${encodeURIComponent(standard!.variantNumber)}&days=30`
      )
    );
    expect(history.meta.cardmarketId).toBe(row?.cardmarketId ?? null);
    expect(history.meta.rowCount).toBeGreaterThan(0);
    expect(history.data.length).toBeGreaterThan(0);
  });

  test('Release printings resolve sibling Cardmarket ids for prices and history', async () => {
    await syncPricesForE2E();

    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?q=OGN-253-Release&limit=10&page=1')
    );
    const release = list.data.find((row) => row.variantNumber === 'OGN-253-Release');
    expect(release).toBeTruthy();
    expect(hasDisplayPrice(release!)).toBe(true);

    const stats = PriceStatsBatchResponse.parse(
      await apiJson<unknown>('/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          items: [{ variantNumber: 'OGN-253-Release' }],
        }),
      })
    );
    expect(stats.data[0]?.cardmarketId).not.toBeNull();
    expect(stats.data[0]?.currentPrice).not.toBeNull();

    const history = PriceHistoryResponse.parse(
      await apiJson<unknown>(
        '/api/v1/prices/history?variantNumber=OGN-253-Release&days=30'
      )
    );
    expect(history.meta.cardmarketId).not.toBeNull();
    expect(history.data.length).toBeGreaterThan(0);
  });

  test('card detail exposes per-variant Cardmarket prices for family switching', async () => {
    await syncPricesForE2E();

    const detail = CardDetailResponse.parse(
      await apiJson<unknown>('/api/v1/cards/OGN-253')
    );
    const release = detail.data.variants.find(
      (variant) => variant.variantNumber === 'OGN-253-Release'
    );
    expect(release).toBeTruthy();
    expect(release!.cardmarketId).not.toBeNull();
    expect(release!.prices.length).toBeGreaterThan(0);
    expect(
      release!.prices.some(
        (price) => (price.market != null && price.market > 0) || price.low != null
      )
    ).toBe(true);
  });

  test('Foil SKUs resolve sibling Cardmarket ids for catalog list and stats batch', async () => {
    await syncPricesForE2E();

    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?q=OGN-001-Foil&limit=10&page=1')
    );
    const foil = list.data.find((row) => row.variantNumber === 'OGN-001-Foil');
    expect(foil).toBeTruthy();
    expect(hasDisplayPrice(foil!)).toBe(true);

    const stats = PriceStatsBatchResponse.parse(
      await apiJson<unknown>('/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          items: [{ variantNumber: 'OGN-001-Foil', isFoil: true }],
        }),
      })
    );
    expect(stats.data[0]?.variantNumber).toBe('OGN-001-Foil');
    expect(stats.data[0]?.cardmarketId).not.toBeNull();
    expect(stats.data[0]?.currentPrice).not.toBeNull();
  });

  test('GET /api/v1/prices resolves variantNumber without cardmarketId query param', async () => {
    await syncPricesForE2E();

    const list = PricesListResponse.parse(
      await apiJson<unknown>(
        '/api/v1/prices?variantNumber=OGN-253-Release&isFoil=false'
      )
    );
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data.every((row) => row.cardmarketId != null)).toBe(true);
    expect(list.meta.rowCount).toBe(list.data.length);

    const history = PriceHistoryResponse.parse(
      await apiJson<unknown>('/api/v1/prices/history?variantNumber=OGN-001a&days=30')
    );
    expect(history.meta.cardmarketId).not.toBeNull();
    expect(history.data.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/sync/prices matches production workflow response contract', async () => {
    const raw = await apiJson<unknown>('/api/v1/sync/prices', {
      method: 'POST',
      headers: adminAuthHeaders(),
    });
    const parsed = SyncPricesResponse.parse(raw);
    expect(parsed.data.source).toBe('cardmarket');
    expect(parsed.data.rowCount).toBeGreaterThan(1000);
    expect(parsed.data.hash.length).toBeGreaterThan(0);
    expect(parsed.data.gameId).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(raw, 'data')).toBe(true);
  });
});
