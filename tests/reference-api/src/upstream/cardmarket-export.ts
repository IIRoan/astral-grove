import { z } from 'zod';

export const CARDMARKET_RIFTBOUND_GAME_ID = 22;

export const CARDMARKET_EXPORT_BASE_URL =
  'https://downloads.s3.cardmarket.com/productCatalog';

const nullableNumber = z
  .number()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const PriceGuideEntrySchema = z.object({
  idProduct: z.number().int(),
  idCategory: z.number().int(),
  avg: nullableNumber,
  low: nullableNumber,
  trend: nullableNumber,
  avg1: nullableNumber,
  avg7: nullableNumber,
  avg30: nullableNumber,
  'avg-foil': nullableNumber,
  'low-foil': nullableNumber,
  'trend-foil': nullableNumber,
  'avg1-foil': nullableNumber,
  'avg7-foil': nullableNumber,
  'avg30-foil': nullableNumber,
});

export const CardmarketPriceGuideExportSchema = z.object({
  version: z.number().int(),
  createdAt: z.string(),
  priceGuides: z.array(PriceGuideEntrySchema),
});

export type CardmarketPriceGuideEntry = z.infer<typeof PriceGuideEntrySchema>;
export type CardmarketPriceGuideExport = z.infer<
  typeof CardmarketPriceGuideExportSchema
>;

export function priceGuideDownloadUrl(gameId: number): string {
  return `${CARDMARKET_EXPORT_BASE_URL}/priceGuide/price_guide_${String(gameId)}.json`;
}

export async function fetchCardmarketPriceGuide(
  gameId: number = CARDMARKET_RIFTBOUND_GAME_ID
): Promise<CardmarketPriceGuideExport> {
  const url = priceGuideDownloadUrl(gameId);
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AstralGrove/1.0 (+https://rift.solace.onl)',
      Referer: 'https://www.cardmarket.com/',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Cardmarket price guide download failed (${String(res.status)} ${res.statusText}) for game ${String(gameId)}`
    );
  }

  const json: unknown = await res.json();
  return CardmarketPriceGuideExportSchema.parse(json);
}
