import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  hasNonFoilPriceGuide,
  mapPriceGuideEntryToRows,
  mapPriceGuideExportToRows,
  normalizeGuideTrend,
  stablePriceRowId,
} from '../../src/lib/cardmarket-price-rows.js';
import {
  CardmarketPriceGuideExportSchema,
  priceGuideDownloadUrl,
} from '../../src/upstream/cardmarket-export.js';

describe('cardmarket price rows', () => {
  test('stablePriceRowId is deterministic per cardmarket id + foil flag', () => {
    const plain = stablePriceRowId(845712, false);
    const foil = stablePriceRowId(845712, true);
    expect(plain).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(plain).not.toBe(foil);
    expect(stablePriceRowId(845712, false)).toBe(plain);
  });

  test('maps trend to marketPrice and low to listing low', () => {
    const [plain, foil] = mapPriceGuideEntryToRows(
      {
        idProduct: 845712,
        idCategory: 1655,
        avg: 0.04,
        low: 0.02,
        trend: 0.05,
        avg1: 0.04,
        avg7: 0.07,
        avg30: 0.04,
        'avg-foil': 0.2,
        'low-foil': 0.02,
        'trend-foil': 0.12,
        'avg1-foil': 0.09,
        'avg7-foil': 0.16,
        'avg30-foil': 0.19,
      },
      new Date('2026-07-13T02:44:15+0200')
    );

    expect(plain?.marketPrice).toBe('0.05');
    expect(plain?.lowPrice).toBe('0.02');
    expect(plain?.avg7Day).toBe('0.07');
    expect(foil?.marketPrice).toBe('0.12');
    expect(foil?.isFoil).toBe(true);
  });

  test('fixture export maps plain + foil rows for mixed products', async () => {
    const raw = await readFile(
      join(import.meta.dir, '../fixtures/cardmarket-price-guide-riftbound.json'),
      'utf8'
    );
    const exportData = CardmarketPriceGuideExportSchema.parse(JSON.parse(raw));
    const rows = mapPriceGuideExportToRows(exportData);

    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.cardmarketId === 845712)).toHaveLength(2);
    expect(
      rows.find((row) => row.cardmarketId === 845721 && !row.isFoil)?.marketPrice
    ).toBe('142.64');
  });

  test('price guide URL uses Riftbound game id 22', () => {
    expect(priceGuideDownloadUrl(22)).toBe(
      'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json'
    );
  });

  test('skips bogus non-foil row when Cardmarket only publishes foil guide data', () => {
    expect(
      hasNonFoilPriceGuide({
        idProduct: 867013,
        idCategory: 1655,
        avg: null,
        low: 190,
        trend: 0,
        avg1: null,
        avg7: null,
        avg30: null,
        'avg-foil': 616.33,
        'low-foil': 190,
        'trend-foil': 367.63,
        'avg1-foil': 400,
        'avg7-foil': 452.43,
        'avg30-foil': 425.12,
      })
    ).toBe(false);
    expect(normalizeGuideTrend(0, null, null)).toBeNull();

    const rows = mapPriceGuideEntryToRows(
      {
        idProduct: 867013,
        idCategory: 1655,
        avg: null,
        low: 190,
        trend: 0,
        avg1: null,
        avg7: null,
        avg30: null,
        'avg-foil': 616.33,
        'low-foil': 190,
        'trend-foil': 367.63,
        'avg1-foil': 400,
        'avg7-foil': 452.43,
        'avg30-foil': 425.12,
      },
      new Date('2026-07-13T02:44:15+0200')
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.isFoil).toBe(true);
    expect(rows[0]?.marketPrice).toBe('367.63');
  });
});
