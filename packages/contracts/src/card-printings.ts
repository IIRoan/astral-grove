import type { CardListItem, CardListPrinting } from './cards.js';
import { collectionFinishKey, isVariantFoil } from './foil.js';

export function sortCardListPrintings(
  printings: readonly CardListPrinting[]
): CardListPrinting[] {
  return [...printings].sort((a, b) => {
    if (a.isFoil !== b.isFoil) return a.isFoil ? 1 : -1;
    return a.variantNumber.localeCompare(b.variantNumber);
  });
}

export function dedupeFinishPrintings(
  printings: readonly CardListPrinting[]
): CardListPrinting[] {
  const hasDistinctFoilSibling = printings.some(
    (printing) =>
      printing.isFoil &&
      printings.some(
        (other) => !other.isFoil && other.variantNumber !== printing.variantNumber
      )
  );

  const filtered = hasDistinctFoilSibling
    ? printings.filter(
        (printing) =>
          !(
            printing.isFoil &&
            printings.some(
              (other) => !other.isFoil && other.variantNumber === printing.variantNumber
            )
          )
      )
    : printings;

  const seen = new Set<string>();
  const result: CardListPrinting[] = [];
  for (const printing of filtered) {
    const key = collectionFinishKey(printing.variantNumber, printing.isFoil);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(printing);
  }
  return result;
}

export function getSearchGroupKey(
  variantNumber: string,
  variantLabel: string,
  variantType?: string,
  foilMode?: string
): string {
  const foil = isVariantFoil(foilMode, variantNumber, variantLabel, variantType);
  if (!foil && variantLabel !== 'Standard' && variantLabel !== 'Foil') {
    return variantNumber;
  }
  let key = variantNumber.replace(/-Foil$/i, '');
  if (foil && key === variantNumber && variantLabel === 'Foil') {
    key = variantNumber.replace(/[a-z]$/i, '');
  }
  return key;
}

export function groupCardListItems(items: readonly CardListItem[]): CardListItem[] {
  const groups = new Map<string, CardListItem>();

  for (const item of items) {
    const printings = item.printings;
    if (printings.length === 0) continue;

    for (const printing of printings) {
      const key = `${item.cardId}:${getSearchGroupKey(
        printing.variantNumber,
        printing.variantLabel,
        undefined,
        printing.foilMode
      )}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          ...item,
          variantNumber: printing.variantNumber,
          priceEur: printing.priceEur,
          printings: [printing],
        });
        continue;
      }

      existing.isBanned = existing.isBanned || item.isBanned;
      existing.printings.push(printing);
    }
  }

  return Array.from(groups.values()).map((item) => {
    const printings = sortCardListPrintings(dedupeFinishPrintings(item.printings));
    const primary = printings.find((printing) => !printing.isFoil) ?? printings[0];
    if (!primary) return item;

    return {
      ...item,
      variantNumber: primary.variantNumber,
      cardmarketId: item.cardmarketId,
      priceEur: primary.priceEur,
      printings,
      isBanned: item.isBanned,
    };
  });
}
