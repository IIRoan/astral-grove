import { describe, expect, test, setDefaultTimeout, beforeAll } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { count, eq } from 'drizzle-orm';
import {
  PriceHistoryResponse,
  PriceStatsBatchResponse,
  PricesListResponse,
} from '@riftbound/contracts';
import {
  mapPriceGuideExportToRows,
  stablePriceRowId,
} from '../../src/lib/cardmarket-price-rows.js';
import { CardmarketPriceGuideExportSchema } from '../../src/upstream/cardmarket-export.js';
import { apiJson, getContext } from './support.js';
import { priceDaily, prices, syncState } from '../../src/db/schema.js';

setDefaultTimeout(180_000);

const TEST_CARDMARKET_ID = 88_888_801;

beforeAll(async () => {
  const { db } = getContext();
  const [priceCount] = await db.select({ value: count() }).from(prices);
  await db
    .update(syncState)
    .set({ rowCount: priceCount?.value ?? 0 })
    .where(eq(syncState.key, 'prices'));
});

describe('price cache database integrity', () => {
  test('prices table row count matches sync status', async () => {
    const { db } = getContext();
    const [priceCount] = await db.select({ value: count() }).from(prices);
    const [sync] = await db
      .select()
      .from(syncState)
      .where(eq(syncState.key, 'prices'))
      .limit(1);

    expect(priceCount?.value ?? 0).toBeGreaterThan(1000);
    expect(sync?.rowCount ?? 0).toBe(priceCount?.value ?? 0);
    expect(sync?.contentHash).toBeTruthy();
    expect(sync?.lastSuccessAt).toBeTruthy();
  });

  test('price_daily has historical rows after sync', async () => {
    const { db } = getContext();
    const [dailyCount] = await db.select({ value: count() }).from(priceDaily);
    expect(dailyCount?.value ?? 0).toBeGreaterThan(1000);
  });
});

describe('price cache service reads', () => {
  test('getRowsForCardmarketIds returns EUR rows from Postgres', async () => {
    const { priceCache } = getContext();
    const listed = await priceCache.list();
    const sample = listed.rows.find((row) => row.cardmarketId != null);
    expect(sample?.cardmarketId).toBeTruthy();

    const rows = await priceCache.getRowsForCardmarketIds([sample!.cardmarketId]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.cardmarketId === sample!.cardmarketId)).toBe(true);
    expect(rows[0]?.currency).toBe('EUR');
  });

  test('list filter matches HTTP prices endpoint', async () => {
    const { priceCache } = getContext();
    const httpAll = PricesListResponse.parse(await apiJson<unknown>('/api/v1/prices'));
    const sample = httpAll.data.find((row) => row.cardmarketId != null);
    expect(sample?.cardmarketId).toBeTruthy();

    const serviceFiltered = await priceCache.list({
      cardmarketId: sample!.cardmarketId,
      isFoil: sample!.isFoil,
    });

    expect(serviceFiltered.rows.length).toBeGreaterThan(0);
    expect(
      serviceFiltered.rows.every(
        (row) =>
          row.cardmarketId === sample!.cardmarketId && row.isFoil === sample!.isFoil
      )
    ).toBe(true);
    expect(serviceFiltered.catalogHash).toBe(httpAll.meta.pricesCatalogHash);
  });

  test('dailyHistory returns dated points for a synced cardmarket id', async () => {
    const { priceCache } = getContext();
    const listed = await priceCache.list();
    const sample = listed.rows.find((row) => row.marketPrice != null);
    expect(sample?.cardmarketId).toBeTruthy();

    const history = await priceCache.dailyHistory({
      cardmarketId: sample!.cardmarketId,
      isFoil: sample!.isFoil,
      days: 30,
    });

    expect(history.rows.length).toBeGreaterThan(0);
    expect(history.rows.every((row) => row.cardmarketId === sample!.cardmarketId)).toBe(
      true
    );
    expect(history.rows.at(-1)?.priceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const httpHistory = PriceHistoryResponse.parse(
      await apiJson<unknown>(
        `/api/v1/prices/history?cardmarketId=${String(sample!.cardmarketId)}&isFoil=${String(
          sample!.isFoil
        )}&days=30`
      )
    );
    expect(httpHistory.data.length).toBe(history.rows.length);
  });

  test('statsBatch resolves variants from the catalog DB', async () => {
    const { priceCache, cardCache } = getContext();
    const index = await cardCache.listIndex();
    const targets = index.items
      .filter((item) => item.cardmarketId != null)
      .slice(0, 5)
      .map((item) => ({ variantNumber: item.variantNumber }));

    const stats = await priceCache.statsBatch(targets, 30);
    expect(stats).toHaveLength(targets.length);
    expect(stats.every((row) => row.currency === 'EUR')).toBe(true);

    const httpStats = PriceStatsBatchResponse.parse(
      await apiJson<unknown>('/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, items: targets }),
      })
    );
    expect(httpStats.data).toHaveLength(stats.length);
    expect(httpStats.data[0]?.variantNumber).toBe(stats[0]?.variantNumber);
  });
});

describe('price cache writes', () => {
  test('persistPriceRows upserts current and daily price rows', async () => {
    const { priceCache, db } = getContext();
    const raw = await readFile(
      join(import.meta.dir, '../fixtures/cardmarket-price-guide-riftbound.json'),
      'utf8'
    );
    const exportData = CardmarketPriceGuideExportSchema.parse(JSON.parse(raw));
    const mapped = mapPriceGuideExportToRows(exportData)
      .filter((row) => row.cardmarketId === 845712)
      .map((row) => ({
        ...row,
        cardmarketId: TEST_CARDMARKET_ID,
        id: stablePriceRowId(TEST_CARDMARKET_ID, row.isFoil),
      }));

    const result = await priceCache.persistPriceRows(mapped, {
      hashInput: mapped.map((row) => ({
        cardmarketId: row.cardmarketId,
        isFoil: row.isFoil,
        lastUpdated: row.lastUpdated.toISOString(),
        marketPrice: row.marketPrice,
      })),
      productCount: 1,
      sourceMeta: {
        source: 'cardmarket',
        gameId: 22,
        exportCreatedAt: exportData.createdAt,
      },
    });

    expect(result.rowCount).toBe(mapped.length);
    expect(result.hash.length).toBeGreaterThan(0);

    const rows = await priceCache.getRowsForCardmarketIds([TEST_CARDMARKET_ID]);
    expect(rows).toHaveLength(mapped.length);

    const [dailyCount] = await db
      .select({ value: count() })
      .from(priceDaily)
      .where(eq(priceDaily.cardmarketId, TEST_CARDMARKET_ID));
    expect(dailyCount?.value ?? 0).toBeGreaterThanOrEqual(mapped.length);

    const stats = await priceCache.statsForVariant({
      variantNumber: 'TEST-PRICE-ROW',
      cardmarketId: TEST_CARDMARKET_ID,
      isFoil: false,
      days: 7,
    });
    expect(stats.currentPrice).not.toBeNull();

    const [priceCount] = await db.select({ value: count() }).from(prices);
    await db
      .update(syncState)
      .set({ rowCount: priceCount?.value ?? 0 })
      .where(eq(syncState.key, 'prices'));
  });
});
