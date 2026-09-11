import type {
  CardListItem,
  CardListPrinting,
  CardDetail,
  PriceSummary,
  VariantDetail,
} from '@riftbound/contracts';
import {
  isCardBannedAt,
  isVariantFoil,
  variantOffersDualFinishes,
} from '@riftbound/contracts';
import type { PaLogicalCard, PaPriceRow, PaVariant } from '@riftbound/contracts';
import { entityHash } from '../lib/hash.js';
import { baseVariantNumberForCardmarket } from '../lib/variant-cardmarket.js';

export {
  getSearchGroupKey,
  groupCardListItems,
} from '@riftbound/contracts';

function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapPriceRows(rows: PaPriceRow[], cardmarketId: number): PriceSummary[] {
  return rows
    .filter((r) => r.cardmarketId === cardmarketId)
    .map((r) => ({
      currency: 'EUR' as const,
      low: parseDecimal(r.lowPrice),
      market: parseDecimal(r.marketPrice),
      avg7d: parseDecimal(r.avg7Day),
      isFoil: r.isFoil,
    }));
}

function hasUsableTrend(row: PriceSummary): boolean {
  return row.market != null && row.market > 0;
}

function pickDisplayPrice(rows: PriceSummary[], isFoil: boolean): PriceSummary | null {
  if (rows.length === 0) return null;

  const rowsWithTrend = rows.filter(hasUsableTrend);
  const matching = rowsWithTrend.find((row) => row.isFoil === isFoil);
  if (matching) return matching;

  // Showcase / signed printings often only have foil trend data in Cardmarket's guide.
  const foilTrend = rowsWithTrend.find((row) => row.isFoil);
  if (foilTrend) return foilTrend;

  const plainTrend = rowsWithTrend.find((row) => !row.isFoil);
  if (plainTrend) return plainTrend;

  const rowsWithLow = rows.filter((row) => row.low != null);
  return (
    rowsWithLow.find((row) => row.isFoil === isFoil) ??
    rowsWithLow.find((row) => row.isFoil) ??
    rowsWithLow[0] ??
    null
  );
}

function printingLabel(isFoil: boolean, variantLabel: string): string {
  if (isFoil) {
    if (variantLabel && variantLabel !== 'Standard' && !/foil/i.test(variantLabel)) {
      return variantLabel;
    }
    return 'Foil';
  }
  return variantLabel || 'Standard';
}

function toPrinting(
  variant: PaVariant,
  isFoil: boolean,
  priceRows: PaPriceRow[]
): CardListPrinting {
  const cmId = variant.cardmarketId ?? null;
  const variantPrices = cmId ? mapPriceRows(priceRows, cmId) : [];
  return {
    variantNumber: variant.variantNumber,
    variantLabel: printingLabel(isFoil, variant.variantLabel),
    isFoil,
    foilMode: variant.foilMode,
    priceEur: pickDisplayPrice(variantPrices, isFoil),
  };
}

function printingsForVariant(
  variant: PaVariant,
  priceRows: PaPriceRow[] = []
): CardListPrinting[] {
  if (
    variantOffersDualFinishes(
      variant.foilMode,
      variant.variantNumber,
      variant.variantLabel,
      variant.variantType
    )
  ) {
    return [
      toPrinting(variant, false, priceRows),
      toPrinting(variant, true, priceRows),
    ];
  }
  const isFoil = isVariantFoil(
    variant.foilMode,
    variant.variantNumber,
    variant.variantLabel,
    variant.variantType
  );
  return [toPrinting(variant, isFoil, priceRows)];
}

export function mapCardDetail(
  card: PaLogicalCard,
  priceRows: PaPriceRow[] = []
): CardDetail {
  const variants = card.variants.map((v) => mapVariantDetail(v, priceRows));
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    super: card.super ?? null,
    description: card.description,
    energy: card.energy,
    might: card.might,
    power: card.power,
    tags: card.tags,
    colors: card.colors.map((c) => ({
      id: c.id,
      name: c.name,
      hexCode: c.hexCode,
      imageUrl: c.imageUrl,
    })),
    variants: inheritFoilSiblingCardmarket(variants, priceRows),
    banEffectiveDate: card.banEffectiveDate ?? null,
  };
}

function inheritFoilSiblingCardmarket(
  variants: VariantDetail[],
  priceRows: PaPriceRow[] = []
): VariantDetail[] {
  const byNumber = new Map(
    variants.map((variant) => [variant.variantNumber.toLowerCase(), variant] as const)
  );

  return variants.map((variant) => {
    if (variant.cardmarketId != null) return variant;
    const base = baseVariantNumberForCardmarket(variant.variantNumber);
    if (base == null) return variant;
    const sibling = byNumber.get(base.toLowerCase());
    const cmId = sibling?.cardmarketId ?? null;
    if (cmId == null) return variant;
    return {
      ...variant,
      cardmarketId: cmId,
      prices: mapPriceRows(priceRows, cmId),
    };
  });
}

function mapVariantDetail(variant: PaVariant, priceRows: PaPriceRow[]): VariantDetail {
  const cmId = variant.cardmarketId ?? null;
  return {
    id: variant.id,
    variantNumber: variant.variantNumber,
    rarity: variant.rarity,
    variantType: variant.variantType,
    variantLabel: variant.variantLabel,
    foilMode: variant.foilMode,
    imageUrl: variant.imageUrl,
    cardmarketId: cmId,
    tcgplayerId: variant.tcgplayerId ?? null,
    releaseDate: variant.releaseDate ?? null,
    artist: variant.artist ?? null,
    prices: cmId ? mapPriceRows(priceRows, cmId) : [],
  };
}

export type ListItemDbRow = {
  cardId: string;
  name: string;
  type: string;
  super: string | null;
  energy: number;
  might: number;
  power: number;
  banEffectiveDate: Date | null;
  variantId: string;
  variantNumber: string;
  rarity: string;
  variantType: string;
  foilMode: string;
  variantLabel: string;
  imageUrl: string;
  cardmarketId: number | null;
  tcgplayerId: number | null;
  setCode: string;
};

export function mapListItemFromDbRow(
  row: ListItemDbRow,
  colorNames: string[],
  priceRows: PaPriceRow[],
  rewriteImageUrl: (url: string) => string
): CardListItem {
  const stubVariant: PaVariant = {
    id: row.variantId,
    variantNumber: row.variantNumber,
    rarity: row.rarity,
    variantType: row.variantType,
    variantLabel: row.variantLabel,
    foilMode: row.foilMode,
    variantTypes: [row.variantType],
    imageUrl: rewriteImageUrl(row.imageUrl),
    showInLibrary: true,
    isCollectible: true,
    cardmarketId: row.cardmarketId,
    tcgplayerId: row.tcgplayerId,
    flavorText: null,
    artist: null,
    releaseDate: null,
    parentVariantId: null,
    set: {
      id: row.setCode,
      prefix: row.setCode,
      name: row.setCode,
    },
  };

  const stubCard: PaLogicalCard = {
    id: row.cardId,
    name: row.name,
    type: row.type,
    super: row.super,
    description: '',
    energy: row.energy,
    might: row.might,
    power: row.power,
    tags: [],
    colors: colorNames.map((name) => ({
      id: row.cardId,
      name,
    })),
    banEffectiveDate: row.banEffectiveDate?.toISOString() ?? null,
    variants: [stubVariant],
  };

  return mapListItem(stubCard, stubVariant, priceRows);
}

export function candidateGroupMaxMarketPrice(
  rows: readonly ListItemDbRow[],
  priceRows: PaPriceRow[]
): number {
  let max = 0;
  for (const row of rows) {
    const item = mapListItemFromDbRow(row, [], priceRows, (url) => url);
    const display = item.priceEur?.market ?? 0;
    if (display > max) max = display;
    for (const printing of item.printings) {
      const amount = printing.priceEur?.market;
      if (amount != null && amount > max) max = amount;
    }
  }
  return max;
}

export function mapListItem(
  card: PaLogicalCard,
  primaryVariant: PaVariant,
  priceRows: PaPriceRow[] = []
): CardListItem {
  const printings = printingsForVariant(primaryVariant, priceRows);
  const primary = printings.find((p) => !p.isFoil) ?? printings[0]!;
  const cmId = primaryVariant.cardmarketId ?? null;

  return {
    cardId: card.id,
    variantNumber: primary.variantNumber,
    name: card.name,
    type: card.type,
    super: card.super ?? null,
    variantType: primaryVariant.variantType,
    energy: card.energy,
    might: card.might,
    power: card.power,
    rarity: primaryVariant.rarity,
    setCode: primaryVariant.set.prefix,
    colors: card.colors.map((c) => c.name),
    imageUrl: primaryVariant.imageUrl,
    cardmarketId: cmId,
    priceEur: primary.priceEur,
    printings,
    isBanned: isCardBannedAt(card.banEffectiveDate ?? null),
  };
}

export function paCardHash(card: PaLogicalCard): string {
  return entityHash(card);
}

export function paVariantHash(variant: PaVariant): string {
  return entityHash(variant);
}
