import type { PaVariant } from '@riftbound/contracts';
import type { CardmarketProduct } from '../upstream/cardmarket-products.js';

export function signedOvernumberedVariantNumber(parentVariantNumber: string): string {
  const trimmed = parentVariantNumber.trim();
  if (trimmed.endsWith('*')) return trimmed;
  return `${trimmed}*`;
}

export function isUnsignedOvernumbered(variant: {
  variantLabel: string;
  variantType: string;
}): boolean {
  const haystack = `${variant.variantType} ${variant.variantLabel}`;
  return /overnumbered/i.test(haystack) && !/signed/i.test(haystack);
}

export function isSignedOvernumbered(variant: {
  variantLabel: string;
  variantType: string;
  variantNumber?: string;
}): boolean {
  if (variant.variantNumber?.trim().endsWith('*')) return true;
  const haystack = `${variant.variantType} ${variant.variantLabel}`;
  return /overnumbered/i.test(haystack) && /signed/i.test(haystack);
}

export function leftoverCardmarketProducts(
  products: readonly CardmarketProduct[],
  usedCardmarketIds: ReadonlySet<number>,
  priceRankByProduct?: ReadonlyMap<number, number>
): CardmarketProduct[] {
  return products
    .filter((product) => !usedCardmarketIds.has(product.idProduct))
    .sort((left, right) => {
      const leftRank = priceRankByProduct?.get(left.idProduct) ?? left.idProduct;
      const rightRank = priceRankByProduct?.get(right.idProduct) ?? right.idProduct;
      if (leftRank !== rightRank) return rightRank - leftRank;
      return right.idProduct - left.idProduct;
    });
}

/** Invent `{overnumberedVN}*` when Cardmarket has a Signed SKU PA has not catalogued yet (VEN-192* style). */
export function buildSyntheticSignedOvernumbered(
  parent: PaVariant,
  cardmarketId: number,
  options?: {
    id?: string;
    imageUrl?: string | null;
    tcgplayerId?: number | null;
  }
): PaVariant {
  const variantTypes = parent.variantTypes.includes('Signed')
    ? parent.variantTypes
    : [...parent.variantTypes, 'Signed'];

  return {
    id: options?.id ?? crypto.randomUUID(),
    variantNumber: signedOvernumberedVariantNumber(parent.variantNumber),
    imageUrl: options?.imageUrl?.trim() || parent.imageUrl,
    rarity: parent.rarity,
    variantType: 'Overnumbered',
    foilMode: parent.foilMode,
    variantTypes,
    showInLibrary: parent.showInLibrary,
    isCollectible: parent.isCollectible,
    variantLabel: 'Overnumbered Signed',
    flavorText: parent.flavorText ?? null,
    artist: parent.artist ?? null,
    releaseDate: parent.releaseDate ?? null,
    cardmarketId,
    tcgplayerId: options?.tcgplayerId ?? null,
    parentVariantId: parent.id,
    set: parent.set,
  };
}
