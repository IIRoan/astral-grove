import { describe, expect, test } from 'bun:test';
import {
  computeCatalogTotal,
  findSetPrintShortfalls,
  sumSetPrintCounts,
  sumVariantTypeCounts,
} from '../../src/lib/catalog-total.js';
import {
  accumulatePrintCounts,
  enrichFilterSnapshotWithPrintCounts,
} from '../../src/services/catalog-probe.js';
import {
  enrichedFilterSnapshot,
  expectedCatalogTotal,
} from '../fixtures/enriched-filters.js';
import type { PaLogicalCard } from '@riftbound/contracts';

const enrichedSnapshot = enrichedFilterSnapshot;

describe('catalog total', () => {
  test('sums expanded per-set print counts from probed snapshot', () => {
    expect(sumSetPrintCounts(enrichedSnapshot)).toBe(expectedCatalogTotal);
    expect(computeCatalogTotal(enrichedSnapshot, 350)).toBe(expectedCatalogTotal);
  });

  test('falls back to variant-type buckets when print counts are absent', () => {
    const snapshot = {
      sets: [{ id: '1', name: 'Origins', count: 354 }],
      variants: enrichedSnapshot.variants,
    };
    expect(sumVariantTypeCounts(snapshot)).toBe(
      enrichedSnapshot.variants.reduce((sum, entry) => sum + entry.count, 0)
    );
    expect(computeCatalogTotal(snapshot, 350)).toBe(sumVariantTypeCounts(snapshot));
  });

  test('enriches filter snapshot with probed set totals', () => {
    const enriched = enrichFilterSnapshotWithPrintCounts(
      {
        colors: [],
        sets: [{ id: '1', code: 'OGN', name: 'Origins', count: 354 }],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      },
      { OGN: 544 }
    );
    expect(enriched.sets[0]?.printCount).toBe(544);
  });

  test('findSetPrintShortfalls reports only sets below expectation', () => {
    expect(
      findSetPrintShortfalls(
        {
          sets: [
            { id: 'ogn', code: 'OGN', name: 'Origins', count: 2, printCount: 2 },
            { id: 'rad', code: 'RAD', name: 'Radiance', count: 5, printCount: 5 },
          ],
        },
        { OGN: 2, RAD: 1 }
      )
    ).toEqual([{ code: 'RAD', expected: 5, actual: 1 }]);
  });
});

describe('catalog probe helpers', () => {
  test('counts only collectible variants on a logical card', () => {
    const card = {
      id: 'card-1',
      variants: [
        { isCollectible: true, set: { prefix: 'OGN' } },
        { isCollectible: false, set: { prefix: 'OGN' } },
        { isCollectible: true, set: { prefix: 'OGN' } },
      ],
    } as PaLogicalCard;

    const totals = new Map<string, number>();
    expect(accumulatePrintCounts(card, totals)).toBe(2);
    expect(totals.get('OGN')).toBe(2);
  });
});
