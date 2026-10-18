import { describe, expect, test } from 'bun:test';
import { computeTrend, formatTrendLabel } from '@riftbound/contracts';
import { computePriceStats, trendPrice } from '../../src/lib/price-stats.js';

describe('price-stats', () => {
  test('trendPrice uses market trend, not cheapest listing', () => {
    expect(
      trendPrice({
        priceDate: '2026-01-01',
        marketPrice: 0.29,
        lowPrice: 0.02,
        midPrice: null,
        highPrice: null,
      })
    ).toBe(0.29);
    expect(
      trendPrice({
        priceDate: '2026-01-01',
        marketPrice: null,
        lowPrice: 0.02,
        midPrice: 0.15,
        highPrice: null,
      })
    ).toBe(0.15);
    expect(
      trendPrice({
        priceDate: '2026-01-01',
        marketPrice: null,
        lowPrice: 0.02,
        midPrice: null,
        highPrice: null,
      })
    ).toBeNull();
  });

  test('computeTrend uses a 5% threshold', () => {
    expect(computeTrend(105, 100)).toEqual({ changePercent: 5, trend: 'up' });
    expect(computeTrend(94, 100)).toEqual({ changePercent: -6, trend: 'down' });
    expect(computeTrend(103, 100)).toEqual({ changePercent: 3, trend: 'flat' });
  });

  test('formatTrendLabel renders signed percentages', () => {
    expect(formatTrendLabel(8, 'up')).toBe('+8%');
    expect(formatTrendLabel(-12, 'down')).toBe('-12%');
    expect(formatTrendLabel(2, 'flat')).toBe('Flat');
  });

  test('computePriceStats summarizes trend series separately from listing low', () => {
    const stats = computePriceStats([
      {
        priceDate: '2026-01-01',
        lowPrice: 0.02,
        marketPrice: 10,
        midPrice: null,
        highPrice: null,
      },
      {
        priceDate: '2026-01-02',
        lowPrice: 0.02,
        marketPrice: 11,
        midPrice: null,
        highPrice: null,
      },
      {
        priceDate: '2026-01-03',
        lowPrice: 0.01,
        marketPrice: 12,
        midPrice: null,
        highPrice: null,
      },
    ]);

    expect(stats.currentPrice).toBe(12);
    expect(stats.baselinePrice).toBe(10);
    expect(stats.minPrice).toBe(10);
    expect(stats.maxPrice).toBe(12);
    expect(stats.avgPrice).toBeCloseTo(11);
    expect(stats.listingLow).toBe(0.01);
    expect(stats.changePercent).toBe(20);
    expect(stats.trend).toBe('up');
  });
});
