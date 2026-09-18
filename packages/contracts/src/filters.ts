import { z } from 'zod';
import { dataMetaResponse, IsoDateTimeString } from './common.js';

const FilterCount = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
});

const SetFilter = FilterCount.extend({
  code: z.string().optional(),
  printCount: z.number().int().optional(),
  // Foil printings include foil_only and explicit foil siblings.
  foilPrintCount: z.number().int().optional(),
});

export const FilterSnapshot = z.object({
  colors: z.array(FilterCount.extend({ imageUrl: z.string().optional() })),
  sets: z.array(SetFilter),
  types: z.array(FilterCount),
  supertypes: z.array(FilterCount),
  rarities: z.array(FilterCount),
  variants: z.array(FilterCount),
});

export const FiltersResponse = dataMetaResponse(
  FilterSnapshot,
  z.object({
    cachedAt: IsoDateTimeString,
    catalogHash: z.string(),
    // Price sync updates this hash and invalidates the catalog index cache.
    pricesCatalogHash: z.string(),
    variantCount: z.number().int().nonnegative(),
  })
);

export type FilterSnapshot = z.infer<typeof FilterSnapshot>;
export type FiltersResponse = z.infer<typeof FiltersResponse>;
