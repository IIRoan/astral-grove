import { z } from 'zod';
import {
  CARDMARKET_EXPORT_BASE_URL,
  CARDMARKET_RIFTBOUND_GAME_ID,
} from './cardmarket-export.js';

const ProductSchema = z.object({
  idProduct: z.number().int(),
  name: z.string(),
  idCategory: z.number().int(),
  categoryName: z.string().optional(),
  idExpansion: z.number().int(),
  idMetacard: z.number().int().optional(),
  dateAdded: z.string().optional(),
});

export const CardmarketProductExportSchema = z.object({
  version: z.number().int(),
  createdAt: z.string(),
  products: z.array(ProductSchema),
});

export type CardmarketProduct = z.infer<typeof ProductSchema>;
export type CardmarketProductExport = z.infer<typeof CardmarketProductExportSchema>;

export function productCatalogDownloadUrl(gameId: number): string {
  return `${CARDMARKET_EXPORT_BASE_URL}/productList/products_singles_${String(gameId)}.json`;
}

export async function fetchCardmarketProductCatalog(
  gameId: number = CARDMARKET_RIFTBOUND_GAME_ID
): Promise<CardmarketProductExport> {
  const url = productCatalogDownloadUrl(gameId);
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AstralGrove/1.0 (+https://rift.solace.onl)',
      Referer: 'https://www.cardmarket.com/',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Cardmarket product catalog download failed (${String(res.status)} ${res.statusText}) for game ${String(gameId)}`
    );
  }

  const json: unknown = await res.json();
  return CardmarketProductExportSchema.parse(json);
}
