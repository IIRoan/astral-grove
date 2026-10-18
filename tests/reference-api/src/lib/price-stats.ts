import { computeTrend } from '@riftbound/contracts';

export type DailyPricePoint = {
  priceDate: string;
  lowPrice: number | null;
  marketPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
};

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function trendPrice(row: DailyPricePoint): number | null {
  return row.marketPrice ?? row.midPrice ?? null;
}

export function computePriceStats(points: DailyPricePoint[]) {
  const sorted = [...points].sort((a, b) => a.priceDate.localeCompare(b.priceDate));
  const trendValues = sorted
    .map((point) => trendPrice(point))
    .filter((value): value is number => value != null);

  const currentPrice =
    sorted.length > 0 ? trendPrice(sorted[sorted.length - 1]!) : null;
  const baselinePrice = sorted.length > 0 ? trendPrice(sorted[0]!) : null;
  const minPrice = trendValues.length > 0 ? Math.min(...trendValues) : null;
  const maxPrice = trendValues.length > 0 ? Math.max(...trendValues) : null;
  const avgPrice =
    trendValues.length > 0
      ? trendValues.reduce((sum, value) => sum + value, 0) / trendValues.length
      : null;
  const listingLow = sorted.length > 0 ? sorted[sorted.length - 1]!.lowPrice : null;
  const { changePercent, trend } = computeTrend(currentPrice, baselinePrice);

  return {
    currentPrice,
    baselinePrice,
    minPrice,
    maxPrice,
    avgPrice,
    listingLow,
    changePercent,
    trend,
    points: sorted,
  };
}
