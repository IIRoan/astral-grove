import type { PriceTrend } from './prices.js';

export const TREND_THRESHOLD_PCT = 5;

export function computeTrend(
  current: number | null,
  baseline: number | null
): { changePercent: number | null; trend: PriceTrend } {
  if (current == null || baseline == null || baseline === 0) {
    return { changePercent: null, trend: 'flat' };
  }

  const changePercent = Math.round(((current - baseline) / baseline) * 100);
  if (changePercent >= TREND_THRESHOLD_PCT) {
    return { changePercent, trend: 'up' };
  }
  if (changePercent <= -TREND_THRESHOLD_PCT) {
    return { changePercent, trend: 'down' };
  }
  return { changePercent, trend: 'flat' };
}

export function formatTrendLabel(
  changePercent: number | null,
  trend: PriceTrend
): string {
  if (changePercent == null || trend === 'flat') return 'Flat';
  return changePercent > 0 ? `+${String(changePercent)}%` : `${String(changePercent)}%`;
}
