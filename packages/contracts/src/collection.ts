import { z } from 'zod';
import { dataResponse, QueryBooleanString } from './common.js';

export const CardCondition = z.enum([
  'mint',
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
  'unspecified',
]);

export type CardCondition = z.infer<typeof CardCondition>;

export const CollectionItem = z.object({
  id: z.string().uuid(),
  variantNumber: z.string(),
  quantity: z.number().int().positive(),
  condition: CardCondition,
  language: z.string(),
  isFoil: z.boolean(),
  notes: z.string().nullable(),
  isGraded: z.boolean(),
  gradeCompany: z.string().nullable(),
  gradeScore: z.string().nullable(),
  acquiredAt: z.string().datetime().nullable(),
  acquiredPriceCents: z.number().int().nullable(),
  addedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  name: z.string(),
  imageUrl: z.string(),
  setCode: z.string(),
  rarity: z.string(),
  type: z.string().nullable(),
  variantLabel: z.string(),
});

export type CollectionItem = z.infer<typeof CollectionItem>;

export const CollectionUpsertRequest = z.object({
  variantNumber: z.string().min(1),
  quantity: z.number().int().min(0).default(1),
  condition: CardCondition.default('near_mint'),
  language: z.string().max(16).default('en'),
  /** Finish stack; required when foilMode=both has no `-Foil` sibling; omitted → API derives from catalog. */
  isFoil: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isGraded: z.boolean().optional(),
  gradeCompany: z.string().max(64).nullable().optional(),
  gradeScore: z.string().max(32).nullable().optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  acquiredPriceCents: z.number().int().nullable().optional(),
});

export type CollectionUpsertRequest = z.infer<typeof CollectionUpsertRequest>;

export const CollectionAdjustRequest = z.object({
  delta: z.number().int().positive().optional().default(1),
  condition: CardCondition.optional().default('near_mint'),
  language: z.string().max(16).optional().default('en'),
  isFoil: z.boolean().optional(),
});

export type CollectionAdjustRequest = z.infer<typeof CollectionAdjustRequest>;

export const CollectionDeleteQuery = z.object({
  condition: CardCondition.optional().default('near_mint'),
  language: z.string().max(16).optional().default('en'),
  isFoil: QueryBooleanString.optional(),
});

export type CollectionDeleteQuery = z.infer<typeof CollectionDeleteQuery>;

export const CollectionBatchSyncRequest = z.object({
  items: z.array(CollectionUpsertRequest).max(500),
});

export const CollectionBatchSyncResponse = dataResponse(
  z.object({ synced: z.number().int().nonnegative() })
);
export type CollectionBatchSyncResponse = z.infer<typeof CollectionBatchSyncResponse>;

export const CollectionClearResponse = dataResponse(
  z.object({ removed: z.number().int().nonnegative() })
);
export type CollectionClearResponse = z.infer<typeof CollectionClearResponse>;

export const CollectionListResponse = z.object({
  data: z.array(CollectionItem),
  meta: z.object({
    total: z.number().int(),
    totalQuantity: z.number().int(),
  }),
});

export const CollectionItemResponse = z.object({
  data: CollectionItem,
});

export const COLLECTION_VARIANT_LOOKUP_MAX = 5000;
export const COLLECTION_VARIANT_LOOKUP_BATCH_SIZE = 200;

export const CollectionVariantNumbersRequest = z.object({
  variantNumbers: z.array(z.string().min(1)).max(COLLECTION_VARIANT_LOOKUP_MAX),
});

export type CollectionVariantNumbersRequest = z.infer<
  typeof CollectionVariantNumbersRequest
>;

export const CollectionQuantitiesRequest = CollectionVariantNumbersRequest;
export type CollectionQuantitiesRequest = CollectionVariantNumbersRequest;

export const CollectionQuantityRow = z.object({
  variantNumber: z.string(),
  isFoil: z.boolean(),
  quantity: z.number().int().nonnegative(),
});

export type CollectionQuantityRow = z.infer<typeof CollectionQuantityRow>;

export const CollectionQuantitiesResponse = z.object({
  data: z.array(CollectionQuantityRow),
});

export type CollectionQuantitiesResponse = z.infer<typeof CollectionQuantitiesResponse>;

export const WishlistItem = z.object({
  id: z.string().uuid(),
  variantNumber: z.string(),
  priority: z.number().int(),
  targetPriceCents: z.number().int().nullable(),
  notes: z.string().nullable(),
  addedAt: z.string().datetime(),
  name: z.string(),
  imageUrl: z.string(),
  setCode: z.string(),
  rarity: z.string(),
  variantLabel: z.string(),
});

export type WishlistItem = z.infer<typeof WishlistItem>;

export const WishlistUpsertRequest = z.object({
  variantNumber: z.string().min(1),
  priority: z.number().int().min(0).max(3).default(0),
  targetPriceCents: z.number().int().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const WishlistListResponse = z.object({
  data: z.array(WishlistItem),
  meta: z.object({ total: z.number().int() }),
});

export const WishlistItemResponse = z.object({
  data: WishlistItem,
});

export const CollectionImportRequest = z.object({
  csv: z.string().min(1).max(512_000).optional(),
  items: z
    .array(
      z.object({
        variantNumber: z.string().min(1),
        quantity: z.number().int().positive(),
        condition: CardCondition.default('near_mint'),
        language: z.string().max(16).default('en'),
        isFoil: z.boolean().optional(),
        notes: z.string().max(2000).nullable().optional(),
        isGraded: z.boolean().optional(),
        gradeCompany: z.string().max(64).nullable().optional(),
        gradeScore: z.string().max(32).nullable().optional(),
      })
    )
    .max(2000)
    .optional(),
});

export type CollectionImportRequest = z.infer<typeof CollectionImportRequest>;

export const CollectionImportResponse = z.object({
  data: z.object({
    imported: z.number().int().nonnegative(),
    totalCopies: z.number().int().nonnegative(),
    rowsProcessed: z.number().int().nonnegative().optional(),
    resolvedFromUpstream: z.number().int().nonnegative().optional(),
    failedRows: z.number().int().nonnegative(),
    errors: z.array(
      z.object({
        row: z.number().int(),
        message: z.string(),
      })
    ),
  }),
});

export type CollectionImportResponse = z.infer<typeof CollectionImportResponse>;
