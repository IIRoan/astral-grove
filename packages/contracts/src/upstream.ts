import { z } from 'zod';

export const PaColor = z.object({
  id: z.string().uuid(),
  name: z.string(),
  hexCode: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const PaSet = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  releaseDate: z.string().optional(),
});

export const PaVariant = z.object({
  id: z.string().uuid(),
  variantNumber: z.string(),
  imageUrl: z.string(),
  rarity: z.string(),
  variantType: z.string(),
  foilMode: z.string(),
  variantTypes: z.array(z.string()),
  showInLibrary: z.boolean(),
  isCollectible: z.boolean(),
  variantLabel: z
    .string()
    .nullish()
    .transform((v) => v ?? 'Standard'),
  flavorText: z.string().nullable().optional(),
  artist: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  cardmarketId: z.number().int().nullable().optional(),
  tcgplayerId: z.number().int().nullable().optional(),
  parentVariantId: z.string().uuid().nullable().optional(),
  set: PaSet,
});

export const PaLogicalCard = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  super: z.string().nullable().optional(),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  energy: z.number().int(),
  might: z.number().int(),
  power: z.number().int(),
  tags: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  attachText: z.string().nullable().optional(),
  effect: z.string().nullable().optional(),
  mightBonus: z.number().optional(),
  maxCopies: z.number().nullable().optional(),
  banEffectiveDate: z.string().nullable().optional(),
  colors: z.array(PaColor),
  variants: z.array(PaVariant),
});

export const PaVariantListItem = PaVariant.extend({
  /** Slim stub from list/batch endpoints — ignored; we always fetch the full card. */
  card: z.unknown().optional(),
});

export const PaCardsListResponse = z.object({
  data: z.array(PaVariantListItem),
  pagination: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean().optional(),
  }),
  meta: z
    .object({
      filters: z.record(z.unknown()),
    })
    .optional(),
});

export const PaCardsBatchResponse = z.object({
  data: z.array(PaVariantListItem),
  notFound: z.array(z.string()),
});

export const PaPriceRow = z.object({
  id: z.string().uuid(),
  cardmarketId: z.number().int(),
  tcgPlayerId: z.number().int().nullable().optional(),
  provider: z.string(),
  isFoil: z.boolean(),
  currency: z.string(),
  lowPrice: z.string().nullable(),
  marketPrice: z.string().nullable(),
  midPrice: z.string().nullable(),
  highPrice: z.string().nullable(),
  directLowPrice: z.string().nullable().optional(),
  avg1Day: z.string().nullable(),
  avg7Day: z.string().nullable(),
  avg30Day: z.string().nullable(),
  lastUpdated: z.string(),
});

export const PaPricesListResponse = z.object({
  data: z.array(PaPriceRow),
});

export type PaLogicalCard = z.infer<typeof PaLogicalCard>;
export type PaVariant = z.infer<typeof PaVariant>;
export type PaVariantListItem = z.infer<typeof PaVariantListItem>;
export type PaPriceRow = z.infer<typeof PaPriceRow>;
export type PaCardsListResponse = z.infer<typeof PaCardsListResponse>;
export type PaPricesListResponse = z.infer<typeof PaPricesListResponse>;
