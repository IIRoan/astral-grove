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

export type HealthResponse = z.infer<typeof HealthResponse>;
export type SyncStatusResponse = z.infer<typeof SyncStatusResponse>;
