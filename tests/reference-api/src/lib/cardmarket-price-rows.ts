import { createHash } from 'node:crypto';
import type { CardmarketPriceGuideEntry } from '../upstream/cardmarket-export.js';
import { entityHash } from './hash.js';

export interface CardmarketPriceRow {
  id: string;
  cardmarketId: number;
  isFoil: boolean;
  provider: 'cardmarket';
  currency: 'EUR';
  lowPrice: string | null;
  marketPrice: string | null;
  midPrice: string | null;
  highPrice: string | null;
  avg1Day: string | null;
  avg7Day: string | null;
  avg30Day: string | null;
  lastUpdated: Date;
  contentHash: string;
}

function formatDecimal(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return value.toFixed(2);
}

function hasPriceData(values: Array<number | null | undefined>): boolean {
  return values.some((value) => value !== null && value !== undefined);
}

/** Cardmarket uses trend:0 + null averages when no non-foil guide exists (foil-only / signed showcase). */
export function hasNonFoilPriceGuide(entry: CardmarketPriceGuideEntry): boolean {
  if (
    entry.avg !== null ||
    entry.avg1 !== null ||
    entry.avg7 !== null ||
    entry.avg30 !== null
  ) {
    return true;
  }
  return entry.trend !== null && entry.trend > 0;
}

export function normalizeGuideTrend(
  trend: number | null,
  avg: number | null,
  avg7: number | null
): number | null {
  if (trend === null) return null;
  if (trend === 0 && avg === null && avg7 === null) return null;
  return trend;
}

export function stablePriceRowId(cardmarketId: number, isFoil: boolean): string {
  const hex = createHash('sha256')
    .update(
      `astral-grove:cardmarket-price:${String(cardmarketId)}:${isFoil ? 'foil' : 'plain'}`
    )
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildRow(input: {
  cardmarketId: number;
  isFoil: boolean;
  low: number | null;
  trend: number | null;
  avg: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  lastUpdated: Date;
}): CardmarketPriceRow {
  const lowPrice = formatDecimal(input.low);
  const marketPrice = formatDecimal(input.trend);
  const midPrice = formatDecimal(input.avg);
  const avg1Day = formatDecimal(input.avg1);
  const avg7Day = formatDecimal(input.avg7);
  const avg30Day = formatDecimal(input.avg30);

  const payload = {
    cardmarketId: input.cardmarketId,
    isFoil: input.isFoil,
    lowPrice,
    marketPrice,
    midPrice,
    avg1Day,
    avg7Day,
    avg30Day,
    lastUpdated: input.lastUpdated.toISOString(),
  };

  return {
    id: stablePriceRowId(input.cardmarketId, input.isFoil),
    cardmarketId: input.cardmarketId,
    isFoil: input.isFoil,
    provider: 'cardmarket',
    currency: 'EUR',
    lowPrice,
    marketPrice,
    midPrice,
    highPrice: null,
    avg1Day,
    avg7Day,
    avg30Day,
    lastUpdated: input.lastUpdated,
    contentHash: entityHash(payload),
  };
}

export function mapPriceGuideEntryToRows(
  entry: CardmarketPriceGuideEntry,
  lastUpdated: Date
): CardmarketPriceRow[] {
  const rows: CardmarketPriceRow[] = [];

  const plainTrend = normalizeGuideTrend(entry.trend, entry.avg, entry.avg7);
  if (
    hasNonFoilPriceGuide(entry) &&
    hasPriceData([
      entry.low,
      plainTrend,
      entry.avg,
      entry.avg1,
      entry.avg7,
      entry.avg30,
    ])
  ) {
    rows.push(
      buildRow({
        cardmarketId: entry.idProduct,
        isFoil: false,
        low: entry.low,
        trend: plainTrend,
        avg: entry.avg,
        avg1: entry.avg1,
        avg7: entry.avg7,
        avg30: entry.avg30,
        lastUpdated,
      })
    );
  }

  if (
    hasPriceData([
      entry['low-foil'],
      entry['trend-foil'],
      entry['avg-foil'],
      entry['avg1-foil'],
      entry['avg7-foil'],
      entry['avg30-foil'],
    ])
  ) {
    rows.push(
      buildRow({
        cardmarketId: entry.idProduct,
        isFoil: true,
        low: entry['low-foil'],
        trend: entry['trend-foil'],
        avg: entry['avg-foil'],
        avg1: entry['avg1-foil'],
        avg7: entry['avg7-foil'],
        avg30: entry['avg30-foil'],
        lastUpdated,
      })
    );
  }

  return rows;
}

export function mapPriceGuideExportToRows(exportData: {
  createdAt: string;
  priceGuides: CardmarketPriceGuideEntry[];
}): CardmarketPriceRow[] {
  const lastUpdated = new Date(exportData.createdAt);
  if (Number.isNaN(lastUpdated.getTime())) {
    throw new Error(`Invalid Cardmarket export createdAt: ${exportData.createdAt}`);
  }

  return exportData.priceGuides.flatMap((entry) =>
    mapPriceGuideEntryToRows(entry, lastUpdated)
  );
}
