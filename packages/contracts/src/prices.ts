import { z } from 'zod';
import {
  dataMetaResponse,
  IsoDateString,
  IsoDateTimeString,
  QueryBooleanString,
} from './common.js';

export const PriceRow = z.object({
  id: z.string().uuid(),
  cardmarketId: z.number().int(),
  isFoil: z.boolean(),
  provider: z.literal('cardmarket'),
  currency: z.literal('EUR'),
  lowPrice: z.number().nullable(),
  marketPrice: z.number().nullable(),
  midPrice: z.number().nullable(),
  highPrice: z.number().nullable(),
  avg1Day: z.number().nullable(),
  avg7Day: z.number().nullable(),
  avg30Day: z.number().nullable(),
  lastUpdated: IsoDateTimeString,
});

export const PriceDailyPoint = z.object({
  cardmarketId: z.number().int(),
  isFoil: z.boolean(),
  provider: z.literal('cardmarket'),
  currency: z.literal('EUR'),
  priceDate: IsoDateString,
  lowPrice: z.number().nullable(),
  marketPrice: z.number().nullable(),
  midPrice: z.number().nullable(),
  highPrice: z.number().nullable(),
});

export const PriceTrend = z.enum(['up', 'down', 'flat']);

export const PriceStats = z.object({
  variantNumber: z.string(),
  cardmarketId: z.number().int().nullable(),
  isFoil: z.boolean(),
  currency: z.literal('EUR'),
  currentPrice: z.number().nullable(),
  baselinePrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  avgPrice: z.number().nullable(),
  listingLow: z.number().nullable(),
  changePercent: z.number().int().nullable(),
  trend: PriceTrend,
  points: z.array(PriceDailyPoint),
  days: z.number().int(),
  priceFilterLabel: z.string(),
  priceSourceNote: z.string(),
  targetPriceCents: z.number().int().nullable().optional(),
  belowTarget: z.boolean().optional(),
});

export const PricesListQuery = z.object({
  cardmarketId: z.coerce.number().int().optional(),
  variantNumber: z.string().optional(),
  isFoil: QueryBooleanString.optional(),
});

export const PriceHistoryQuery = z.object({
  cardmarketId: z.coerce.number().int().optional(),
  variantNumber: z.string().optional(),
  isFoil: QueryBooleanString.optional(),
  days: z.coerce.number().int().positive().max(365).default(30),
});

export const PriceStatsBatchRequest = z.object({
  items: z
    .array(
      z.object({
        variantNumber: z.string().min(1),
        isFoil: z.boolean().optional(),
        targetPriceCents: z.number().int().nullable().optional(),
      })
    )
    .min(1)
    .max(200),
  days: z.coerce.number().int().positive().max(365).default(30),
});

export const PricesListResponse = dataMetaResponse(
  z.array(PriceRow),
  z.object({
    pricesCatalogHash: z.string(),
    lastSyncedAt: IsoDateTimeString.nullable(),
    rowCount: z.number().int(),
  })
);

export const PriceHistoryResponse = dataMetaResponse(
  z.array(PriceDailyPoint),
  z.object({
    cardmarketId: z.number().int().nullable(),
    isFoil: z.boolean().nullable(),
    days: z.number().int(),
    rowCount: z.number().int(),
  })
);

export const PriceStatsBatchResponse = dataMetaResponse(
  z.array(PriceStats),
  z.object({
    days: z.number().int(),
    rowCount: z.number().int(),
  })
);

export type PriceRow = z.infer<typeof PriceRow>;
export type PriceDailyPoint = z.infer<typeof PriceDailyPoint>;
export type PriceTrend = z.infer<typeof PriceTrend>;
export type PriceStats = z.infer<typeof PriceStats>;
export type PriceHistoryQuery = z.infer<typeof PriceHistoryQuery>;
export type PriceStatsBatchRequest = z.infer<typeof PriceStatsBatchRequest>;
