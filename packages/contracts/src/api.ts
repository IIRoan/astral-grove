import { z } from 'zod';
import { dataResponse, IsoDateTimeString } from './common.js';

export const HealthResponse = dataResponse(
  z.object({
    status: z.literal('ok'),
    db: z.enum(['ok', 'error']),
    lastCatalogSync: IsoDateTimeString.nullable(),
    emailVerificationRequired: z.boolean(),
  })
);

export const SyncStatusResponse = dataResponse(
  z.object({
    catalog: z.object({
      lastRun: IsoDateTimeString.nullable(),
      status: z.enum(['idle', 'running', 'failed']),
      hash: z.string(),
      variantCount: z.number().int(),
    }),
    prices: z.object({
      lastRun: IsoDateTimeString.nullable(),
      status: z.enum(['idle', 'running', 'failed']),
      hash: z.string(),
      rowCount: z.number().int(),
    }),
  })
);

export const SyncCatalogResponse = dataResponse(
  z.object({
    changed: z.boolean(),
    pages: z.number().int().nonnegative(),
    variantCount: z.number().int().nonnegative(),
    hash: z.string(),
  })
);

export const SyncPricesResponse = dataResponse(
  z.object({
    changed: z.boolean(),
    rowCount: z.number().int().nonnegative(),
    productCount: z.number().int().nonnegative(),
    hash: z.string(),
    source: z.literal('cardmarket'),
    gameId: z.number().int(),
    exportCreatedAt: z.string(),
    cardmarketIdsBackfilled: z.number().int().nonnegative(),
  })
);

export type HealthResponse = z.infer<typeof HealthResponse>;
export type SyncStatusResponse = z.infer<typeof SyncStatusResponse>;
export type SyncCatalogResponse = z.infer<typeof SyncCatalogResponse>;
export type SyncPricesResponse = z.infer<typeof SyncPricesResponse>;
