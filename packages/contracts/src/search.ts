import { z } from 'zod';
import { VariantNumber } from './cards.js';
import { dataMetaResponse } from './common.js';

export const SearchEntityType = z.enum(['cards', 'decks', 'navigation', 'actions']);

export const GlobalSearchQuery = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
  page: z.coerce.number().int().positive().default(1),
});

export const SearchHitCard = z.object({
  kind: z.literal('card'),
  variantNumber: VariantNumber,
  name: z.string(),
  imageUrl: z.string().url(),
  setCode: z.string(),
  type: z.string(),
  rarity: z.string(),
  textMatch: z.number().optional(),
});

export const SearchHitDeck = z.object({
  kind: z.literal('deck'),
  id: z.string(),
  name: z.string(),
  textMatch: z.number().optional(),
});

export const GlobalSearchResponse = dataMetaResponse(
  z.object({
    cards: z
      .object({
        hits: z.array(SearchHitCard),
        total: z.number().int().nonnegative(),
      })
      .optional(),
    decks: z
      .object({
        hits: z.array(SearchHitDeck),
        total: z.number().int().nonnegative(),
      })
      .optional(),
  }),
  z.object({
    tookMs: z.number().int().nonnegative(),
    catalogHash: z.string(),
  })
);

export type SearchEntityType = z.infer<typeof SearchEntityType>;
export type GlobalSearchQuery = z.infer<typeof GlobalSearchQuery>;
export type SearchHitCard = z.infer<typeof SearchHitCard>;
export type SearchHitDeck = z.infer<typeof SearchHitDeck>;
export type GlobalSearchResponse = z.infer<typeof GlobalSearchResponse>;
