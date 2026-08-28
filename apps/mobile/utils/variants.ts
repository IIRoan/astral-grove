import type {
  CardListItem,
  CardListPrinting,
  CardsListResponse,
} from '@riftbound/contracts';
import {
  collectionFinishKey,
  computeTrend,
  dedupeFinishPrintings,
  formatTrendLabel,
  getSearchGroupKey,
  groupCardListItems as groupSharedCardListItems,
  isVariantFoil,
  sortCardListPrintings,
  variantOffersDualFinishes,
} from '@riftbound/contracts';

export function isFoilVariant(
  variantNumber: string,
  variantLabel?: string,
  variantType?: string,
  foilMode?: string
): boolean {
  return isVariantFoil(foilMode, variantNumber, variantLabel, variantType);
}

export { collectionFinishKey, getSearchGroupKey };

export function ownedQuantityForPrinting(
  collectionByVariant: ReadonlyMap<string, { quantity: number }> | undefined,
  printing: Pick<CardListPrinting, 'variantNumber' | 'isFoil'>
): number {
  if (!collectionByVariant) return 0;
  const finishKey = collectionFinishKey(printing.variantNumber, printing.isFoil);
  const byFinish = collectionByVariant.get(finishKey);
  if (byFinish) return byFinish.quantity;

  // Finish-aware maps write `::std`/`::foil`; do not fall back to aggregate VN (would double-count foil).
  const stdKey = collectionFinishKey(printing.variantNumber, false);
  const foilKey = collectionFinishKey(printing.variantNumber, true);
  if (collectionByVariant.has(stdKey) || collectionByVariant.has(foilKey)) {
    return 0;
  }

  // Legacy ownership maps keyed only by variant number (pre-finish stacks).
  return collectionByVariant.get(printing.variantNumber)?.quantity ?? 0;
}

export function variantNumbersMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function findVariantByNumber<T extends { variantNumber: string }>(
  variants: T[],
  variantNumber: string
): T | undefined {
  return variants.find((v) => variantNumbersMatch(v.variantNumber, variantNumber));
}

const syntheticByVariant = new Map<string, CardListPrinting[]>();

function syntheticPrintings(card: CardListItem): CardListPrinting[] {
  const hit = syntheticByVariant.get(card.variantNumber);
  if (hit) return hit;

  const isFoil = isFoilVariant(card.variantNumber);
  const row: CardListPrinting[] = [
    {
      variantNumber: card.variantNumber,
      variantLabel: isFoil ? 'Foil' : 'Standard',
      isFoil,
      priceEur: card.priceEur ?? null,
    },
  ];
  syntheticByVariant.set(card.variantNumber, row);
  return row;
}

/** Fast path when `printings` already present; synthesizes one for legacy cache rows. */
export function getCardPrintings(card: CardListItem): CardListPrinting[] {
  const printings = card.printings;
  return printings && printings.length > 0 ? printings : syntheticPrintings(card);
}

export function normalizeCardListItem(card: CardListItem): CardListItem {
  if (card.printings && card.printings.length > 0) return card;
  return { ...card, printings: syntheticPrintings(card) };
}

export function normalizeCardsListResponse(
  response: CardsListResponse
): CardsListResponse {
  let needsNormalize = false;
  for (const card of response.data) {
    if (!card.printings?.length) {
      needsNormalize = true;
      break;
    }
  }
  if (!needsNormalize) return response;
  return { ...response, data: response.data.map(normalizeCardListItem) };
}

export function normalizeCardListItems(items: CardListItem[]): CardListItem[] {
  if (items.length === 0) return items;
  for (const card of items) {
    if (!card.printings?.length) return items.map(normalizeCardListItem);
  }
  return items;
}

export function formatPrintingLabel(
  variantLabel: string,
  isFoil: boolean,
  variantNumber: string
): string {
  if (variantLabel && variantLabel !== 'Standard') return variantLabel;
  if (isFoil) return 'Foil';
  if (/foil/i.test(variantNumber)) return 'Foil';
  return 'Standard';
}

export function hasMultiplePrintings(printings: CardListPrinting[]): boolean {
  return printings.length > 1;
}

function sortPrintings(printings: CardListPrinting[]): CardListPrinting[] {
  return sortCardListPrintings(printings);
}

export type VariantLike = {
  variantNumber: string;
  variantLabel: string;
  variantType?: string;
  foilMode?: string;
};

/** Expand catalog variants into finish printings (foilMode=both → std + foil). */
export function expandVariantFinishPrintings<T extends VariantLike>(
  variants: readonly T[]
): CardListPrinting[] {
  const rows: CardListPrinting[] = [];
  for (const variant of variants) {
    if (
      variantOffersDualFinishes(
        variant.foilMode,
        variant.variantNumber,
        variant.variantLabel,
        variant.variantType
      )
    ) {
      rows.push({
        variantNumber: variant.variantNumber,
        variantLabel: 'Standard',
        isFoil: false,
        foilMode: variant.foilMode,
        priceEur: null,
      });
      rows.push({
        variantNumber: variant.variantNumber,
        variantLabel: 'Foil',
        isFoil: true,
        foilMode: variant.foilMode,
        priceEur: null,
      });
      continue;
    }
    const isFoil = isFoilVariant(
      variant.variantNumber,
      variant.variantLabel,
      variant.variantType,
      variant.foilMode
    );
    rows.push({
      variantNumber: variant.variantNumber,
      variantLabel: formatPrintingLabel(
        variant.variantLabel,
        isFoil,
        variant.variantNumber
      ),
      isFoil,
      foilMode: variant.foilMode,
      priceEur: null,
    });
  }
  return dedupeFinishPrintings(rows);
}

/** Keep foil + non-foil of the same printing; exclude alternate art / promo / overnumbered rows. */
export function getSearchGroupVariants<T extends VariantLike>(
  variants: T[],
  anchor: VariantLike
): T[] {
  const key = getSearchGroupKey(
    anchor.variantNumber,
    anchor.variantLabel,
    anchor.variantType,
    anchor.foilMode
  );
  return variants.filter(
    (variant) =>
      getSearchGroupKey(
        variant.variantNumber,
        variant.variantLabel,
        variant.variantType,
        variant.foilMode
      ) === key
  );
}

export type VariantFamily<T extends VariantLike = VariantLike> = {
  key: string;
  label: string;
  representativeVariantNumber: string;
  variants: T[];
};

export function sortVariantFamilies<T extends { label: string }>(families: T[]): T[] {
  return [...families].sort((a, b) => {
    if (a.label === 'Standard') return -1;
    if (b.label === 'Standard') return 1;
    return a.label.localeCompare(b.label);
  });
}

export function groupPrintingsBySearchGroup(
  printings: CardListPrinting[]
): CardListPrinting[][] {
  const groups = new Map<string, CardListPrinting[]>();

  for (const printing of printings) {
    const key = getSearchGroupKey(
      printing.variantNumber,
      printing.variantLabel,
      undefined,
      printing.foilMode
    );
    const group = groups.get(key) ?? [];
    group.push(printing);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) =>
    sortPrintings(dedupeFinishPrintings(group))
  );
}

export function getVariantFamiliesFromPrintings(
  printings: CardListPrinting[]
): VariantFamily<CardListPrinting>[] {
  return sortVariantFamilies(
    groupPrintingsBySearchGroup(printings).map((group) => {
      const primary = group.find((p) => !p.isFoil) ?? group[0]!;
      const label =
        primary.variantLabel !== 'Standard' && !primary.isFoil
          ? primary.variantLabel
          : 'Standard';
      return {
        key: getSearchGroupKey(
          primary.variantNumber,
          primary.variantLabel,
          undefined,
          primary.foilMode
        ),
        label,
        representativeVariantNumber: primary.variantNumber,
        variants: group,
      };
    })
  );
}

export function getVariantFamiliesFromCardVariants<T extends VariantLike>(
  variants: T[]
): VariantFamily<T>[] {
  const groups = new Map<string, T[]>();

  for (const variant of variants) {
    const key = getSearchGroupKey(
      variant.variantNumber,
      variant.variantLabel,
      variant.variantType,
      variant.foilMode
    );
    const group = groups.get(key) ?? [];
    group.push(variant);
    groups.set(key, group);
  }

  return sortVariantFamilies(
    [...groups.entries()].map(([, group]) => {
      const primary =
        group.find(
          (variant) =>
            !isFoilVariant(
              variant.variantNumber,
              variant.variantLabel,
              variant.variantType,
              variant.foilMode
            )
        ) ?? group[0]!;
      const label =
        primary.variantLabel !== 'Standard' ? primary.variantLabel : 'Standard';
      return {
        key: getSearchGroupKey(
          primary.variantNumber,
          primary.variantLabel,
          primary.variantType,
          primary.foilMode
        ),
        label,
        representativeVariantNumber: primary.variantNumber,
        variants: group,
      };
    })
  );
}

export function getPrintingsInSearchGroup(
  printings: CardListPrinting[],
  anchorVariantNumber: string
): CardListPrinting[] {
  const anchor = printings.find((p) =>
    variantNumbersMatch(p.variantNumber, anchorVariantNumber)
  );
  if (!anchor) {
    const families = getVariantFamiliesFromPrintings(printings);
    return families[0]?.variants ?? printings;
  }
  return getSearchGroupVariants(printings, anchor);
}

export function cardListItemMatchesVariant(
  card: Pick<CardListItem, 'variantNumber' | 'printings'>,
  variantNumber: string | null | undefined
): boolean {
  if (!variantNumber) return false;
  if (variantNumbersMatch(card.variantNumber, variantNumber)) return true;
  return (card.printings ?? []).some((p) =>
    variantNumbersMatch(p.variantNumber, variantNumber)
  );
}

export function groupCardListItems(items: CardListItem[]): CardListItem[] {
  return groupSharedCardListItems(
    items.map((item) =>
      item.printings?.length ? item : { ...item, printings: getCardPrintings(item) }
    )
  );
}

export type VariantPriceLike = {
  market: number | null;
  low: number | null;
  isFoil: boolean;
  avg7d?: number | null;
};

export type VariantIdentity = {
  variantNumber: string;
  variantLabel: string;
  variantType?: string;
  foilMode?: string;
};

/** Match Cardmarket finish to catalog variant — foil fallback when only one guide exists. */
export function pickVariantDisplayPrice<T extends VariantPriceLike>(
  prices: readonly T[],
  variant: VariantIdentity
): T | null {
  if (prices.length === 0) return null;

  const isFoil = isFoilVariant(
    variant.variantNumber,
    variant.variantLabel,
    variant.variantType,
    variant.foilMode
  );
  const rowsWithMarket = prices.filter((row) => row.market != null && row.market > 0);
  const matching = rowsWithMarket.find((row) => row.isFoil === isFoil);
  if (matching) return matching;

  // Showcase / signed printings often only have foil trend data in Cardmarket's guide.
  const foilTrend = rowsWithMarket.find((row) => row.isFoil);
  if (foilTrend) return foilTrend;

  const plainTrend = rowsWithMarket.find((row) => !row.isFoil);
  if (plainTrend) return plainTrend;

  const rowsWithLow = prices.filter((row) => row.low != null);
  return (
    rowsWithLow.find((row) => row.isFoil === isFoil) ??
    rowsWithLow.find((row) => row.isFoil) ??
    rowsWithLow[0] ??
    null
  );
}

export function toPriceEurSummary(
  price: VariantPriceLike | null | undefined
): CardListItem['priceEur'] {
  if (!price || price.market == null) return null;
  return {
    currency: 'EUR',
    low: price.low,
    market: price.market,
    avg7d: price.avg7d ?? null,
    isFoil: price.isFoil,
  };
}

function priceAmount(price: CardListItem['priceEur']): number | null {
  if (!price) return null;
  return price.market ?? null;
}

/** Highest Cardmarket trend across a card row and all of its printings. */
export function getCardMaxMarketPrice(card: CardListItem): number {
  const printings = getCardPrintings(card);
  let max = priceAmount(card.priceEur) ?? 0;
  for (const printing of printings) {
    const amount = priceAmount(printing.priceEur);
    if (amount != null && amount > max) max = amount;
  }
  return max;
}

export function formatListPrice(card: CardListItem): string | null {
  const printings = getCardPrintings(card);
  let min: number | null = null;
  let max: number | null = null;

  for (const p of printings) {
    const amount = priceAmount(p.priceEur);
    if (amount == null) continue;
    if (min == null || amount < min) min = amount;
    if (max == null || amount > max) max = amount;
  }

  if (min == null || max == null) {
    const single = priceAmount(card.priceEur);
    return single != null ? `€${single.toFixed(2)}` : null;
  }

  if (min === max) return `€${min.toFixed(2)}`;
  return `€${min.toFixed(2)}–${max.toFixed(2)}`;
}

export function printingSummary(card: CardListItem): string | null {
  const printings = getCardPrintings(card);
  if (!hasMultiplePrintings(printings)) return null;
  let hasFoil = false;
  let hasStd = false;
  for (const p of printings) {
    if (p.isFoil) hasFoil = true;
    else hasStd = true;
  }
  const parts: string[] = [];
  if (hasStd) parts.push('Std');
  if (hasFoil) parts.push('Foil');
  return parts.join(' · ');
}

export function formatPrintingPrice(price: CardListItem['priceEur']): string | null {
  const amount = priceAmount(price);
  return amount != null ? `€${amount.toFixed(2)}` : null;
}

export type MarketPriceDisplay = {
  label: string;
  price: string;
};

function formatPriceRowAmount(row: { market: number | null }): string | null {
  const amount = row.market;
  return amount != null ? `€${amount.toFixed(2)}` : null;
}

/** Show only prices relevant to this printing — not every Cardmarket finish on the product id. */
export function getVariantMarketPriceDisplays(variant: {
  variantNumber: string;
  variantLabel: string;
  variantType: string;
  foilMode?: string;
  prices: { market: number | null; low: number | null; isFoil: boolean }[];
}): MarketPriceDisplay[] {
  const isFoil = isFoilVariant(
    variant.variantNumber,
    variant.variantLabel,
    variant.variantType,
    variant.foilMode
  );
  const label = formatPrintingLabel(
    variant.variantLabel,
    isFoil,
    variant.variantNumber
  );

  const matching = pickVariantDisplayPrice(variant.prices, variant);
  if (!matching) return [];

  const price = formatPriceRowAmount(matching);
  return price ? [{ label, price }] : [];
}

/** Derive a week-over-week style trend label from market vs avg7d. */
export function formatMarketTrend(price: CardListItem['priceEur']): string {
  if (!price?.market || !price.avg7d) return 'Flat';
  const { changePercent, trend } = computeTrend(price.market, price.avg7d);
  return formatTrendLabel(changePercent, trend);
}

export function totalOwnedForCard(
  card: CardListItem,
  collectionByVariant?: ReadonlyMap<string, { quantity: number }>
): number {
  if (!collectionByVariant) return 0;
  return getCardPrintings(card).reduce(
    (sum, p) => sum + ownedQuantityForPrinting(collectionByVariant, p),
    0
  );
}
