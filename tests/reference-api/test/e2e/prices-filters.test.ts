import { describe, expect, test } from 'bun:test';
import {
  FiltersResponse,
  PriceHistoryResponse,
  PriceStatsBatchResponse,
  PricesListResponse,
} from '@riftbound/contracts';
import { apiJson, syncPricesForE2E } from './support.js';
import {
  enrichedFilterSnapshot,
  expectedCatalogTotal,
} from '../fixtures/enriched-filters.js';
import { sumSetPrintCounts } from '../../src/lib/catalog-total.js';

describe('filters', () => {
  test('GET /api/v1/filters returns sets, colors, rarities', async () => {
    const json = await apiJson<unknown>('/api/v1/filters');
    const parsed = FiltersResponse.parse(json);

    expect(parsed.data.sets.length).toBeGreaterThan(0);
    expect(parsed.data.colors.length).toBeGreaterThan(0);
    expect(parsed.data.rarities.length).toBeGreaterThan(0);
    expect(parsed.data.sets[0]?.name).toBeTruthy();
    expect(parsed.meta.variantCount).toBeGreaterThanOrEqual(expectedCatalogTotal);
    expect(parsed.meta.catalogHash.length).toBeGreaterThan(0);
    expect(parsed.meta.pricesCatalogHash.length).toBeGreaterThan(0);
    expect(parsed.meta.variantCount).toBeGreaterThanOrEqual(
      sumSetPrintCounts(parsed.data)
    );
    const ogn = parsed.data.sets.find((s) => s.code === 'OGN');
    expect(ogn?.printCount).toBe(
      enrichedFilterSnapshot.sets.find((s) => s.code === 'OGN')?.printCount
    );
    expect((ogn?.printCount ?? 0) > (ogn?.count ?? 0)).toBe(true);
  });
});

describe('prices (Cardmarket EUR cache)', () => {
  test('GET /api/v1/prices returns cached rows with EUR currency', async () => {
    const json = await apiJson<unknown>('/api/v1/prices');
    const parsed = PricesListResponse.parse(json);

    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.meta.rowCount).toBeGreaterThan(0);
    expect(parsed.data[0]?.currency).toBe('EUR');
    expect(parsed.meta.lastSyncedAt).toBeTruthy();
  });

  test('GET /api/v1/prices?cardmarketId= filters to a single cardmarket id', async () => {
    const all = PricesListResponse.parse(await apiJson<unknown>('/api/v1/prices'));
    const sample = all.data.find((r) => r.cardmarketId != null);
    expect(sample?.cardmarketId).toBeTruthy();

    const json = await apiJson<unknown>(
      `/api/v1/prices?cardmarketId=${String(sample!.cardmarketId)}`
    );
    const parsed = PricesListResponse.parse(json);

    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.data.every((r) => r.cardmarketId === sample!.cardmarketId)).toBe(
      true
    );
  }, 60_000);

  test('GET /api/v1/prices/history returns daily snapshots for a cardmarket id', async () => {
    await syncPricesForE2E();

    const all = PricesListResponse.parse(await apiJson<unknown>('/api/v1/prices'));
    const sample = all.data.find((r) => r.cardmarketId != null);
    expect(sample?.cardmarketId).toBeTruthy();

    const history = PriceHistoryResponse.parse(
      await apiJson<unknown>(
        `/api/v1/prices/history?cardmarketId=${String(sample!.cardmarketId)}&isFoil=${String(
          sample!.isFoil
        )}&days=365`
      )
    );

    expect(history.meta.cardmarketId).toBe(sample!.cardmarketId);
    expect(history.meta.isFoil).toBe(sample!.isFoil);
    expect(history.meta.rowCount).toBeGreaterThan(0);
    expect(history.data.length).toBeGreaterThan(0);
    expect(history.data.every((row) => row.cardmarketId === sample!.cardmarketId)).toBe(
      true
    );
    expect(history.data.every((row) => row.isFoil === sample!.isFoil)).toBe(true);
    expect(history.data.at(-1)?.priceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 300_000);

  test('POST /api/v1/prices/stats/batch returns computed stats for variants', async () => {
    await syncPricesForE2E();

    const cards = await apiJson<{ data: { variantNumber: string }[] }>(
      '/api/v1/cards?limit=1'
    );
    const variantNumber = cards.data[0]?.variantNumber;
    expect(variantNumber).toBeTruthy();

    const json = await apiJson<unknown>('/api/v1/prices/stats/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: 30,
        items: [{ variantNumber }],
      }),
    });

    const parsed = PriceStatsBatchResponse.parse(json);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.variantNumber).toBe(variantNumber);
    expect(parsed.data[0]?.currency).toBe('EUR');
    expect(parsed.meta.days).toBe(30);
  }, 300_000);
});
