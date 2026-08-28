import { z } from 'zod';
import { dataMetaResponse, QueryBooleanString } from './common.js';

export const VariantNumber = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9]+-[A-Za-z0-9]+([-*_.][A-Za-z0-9]+)*\*?$/);

export const Pagination = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean().optional(),
});

export const ColorRef = z.object({
  id: z.string().uuid(),
  name: z.string(),
  hexCode: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const PriceSummary = z.object({
  currency: z.literal('EUR'),
  low: z.number().nullable(),
  market: z.number().nullable(),
  avg7d: z.number().nullable(),
  isFoil: z.boolean(),
});

export const CardListPrinting = z.object({
  variantNumber: VariantNumber,
  variantLabel: z.string(),
  isFoil: z.boolean(),
  foilMode: z.string().optional(),
  priceEur: PriceSummary.nullable(),
});

export const CardListItem = z.object({
  cardId: z.string().uuid(),
  variantNumber: VariantNumber,
  name: z.string(),
  type: z.string(),
  super: z.string().nullable().optional(),
  variantType: z.string().optional(),
  energy: z.number().int(),
  might: z.number().int(),
  power: z.number().int(),
  rarity: z.string(),
  setCode: z.string(),
  colors: z.array(z.string()),
  imageUrl: z.string().url(),
  cardmarketId: z.number().int().nullable(),
  priceEur: PriceSummary.nullable(),
  printings: z.array(CardListPrinting).min(1),
  isBanned: z.boolean(),
});

export const VariantDetail = z.object({
  id: z.string().uuid(),
  variantNumber: VariantNumber,
  rarity: z.string(),
  variantType: z.string(),
  variantLabel: z.string(),
  foilMode: z.string(),
  imageUrl: z.string().url(),
  cardmarketId: z.number().int().nullable(),
  tcgplayerId: z.number().int().nullable(),
  releaseDate: z.string().nullable(),
  artist: z.string().nullable(),
  prices: z.array(PriceSummary),
});

export const CardDetail = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  super: z.string().nullable(),
  description: z.string(),
  energy: z.number().int(),
  might: z.number().int(),
  power: z.number().int(),
  tags: z.array(z.string()),
  colors: z.array(ColorRef),
  variants: z.array(VariantDetail),
  banEffectiveDate: z.string().nullable(),
});

export const CardsListQuery = z.object({
  q: z.string().max(200).optional(),
  sets: z.string().optional(),
  colors: z.string().optional(),
  // all requires every listed color; within keeps cards inside the chosen identity.
  colorMode: z.enum(['all', 'within']).default('all'),
  types: z.string().optional(),
  super: z.string().optional(),
  variants: z.string().optional(),
  rarities: z.string().optional(),
  energyMin: z.coerce.number().int().optional(),
  energyMax: z.coerce.number().int().optional(),
  powerMin: z.coerce.number().int().optional(),
  powerMax: z.coerce.number().int().optional(),
  mightMin: z.coerce.number().int().optional(),
  mightMax: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z
    .enum(['name', 'energy', 'variantNumber', 'releaseDate', 'price'])
    .default('name'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  refresh: QueryBooleanString.optional(),
  excludeTokens: QueryBooleanString.optional(),
});

export const CardsDetailQuery = z.object({
  refresh: QueryBooleanString.optional(),
});

export const CardsListResponse = dataMetaResponse(
  z.array(CardListItem),
  z.object({
    pagination: Pagination,
    source: z.enum(['cache', 'mixed', 'upstream']),
    catalogHash: z.string(),
  })
);

export const CardDetailResponse = z.object({
  data: CardDetail,
  meta: z.object({
    source: z.enum(['cache', 'upstream', 'cache-refreshed']),
    contentHash: z.string(),
  }),
});

export const CardsBatchRequest = z.object({
  variantNumbers: z.array(VariantNumber).min(1).max(100),
});

export const CardsBatchResponse = dataMetaResponse(
  z.array(CardDetail),
  z.object({
    found: z.number().int(),
    notFound: z.array(z.string()),
    source: z.enum(['cache', 'mixed', 'upstream']),
  })
);

export const CatalogIndexResponse = dataMetaResponse(
  z.array(CardListItem),
  z.object({
    catalogHash: z.string(),
    pricesCatalogHash: z.string(),
    total: z.number().int().nonnegative(),
    source: z.enum(['cache']),
  })
);

export type CatalogIndexResponse = z.infer<typeof CatalogIndexResponse>;

export type VariantNumber = z.infer<typeof VariantNumber>;
export type PriceSummary = z.infer<typeof PriceSummary>;
export type CardListPrinting = z.infer<typeof CardListPrinting>;
export type CardListItem = z.infer<typeof CardListItem>;
export type VariantDetail = z.infer<typeof VariantDetail>;
export type CardDetail = z.infer<typeof CardDetail>;
export type CardsListQuery = z.infer<typeof CardsListQuery>;
export type CardsDetailQuery = z.infer<typeof CardsDetailQuery>;
export type CardsListResponse = z.infer<typeof CardsListResponse>;
export type CardDetailResponse = z.infer<typeof CardDetailResponse>;
export type CardsBatchResponse = z.infer<typeof CardsBatchResponse>;
