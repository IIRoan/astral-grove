import {
  lexicalRelevanceScore,
  matchesSearchHaystack,
  tokenizeSearchQuery,
  type CardListItem,
} from '@riftbound/contracts';
import type { CatalogSort } from '@/constants/catalogSort';
import { getCardMaxMarketPrice, getCardPrintings } from '@/utils/variants';

export { tokenizeSearchQuery };

function buildSearchBlob(card: CardListItem): string {
  const printings = getCardPrintings(card);
  const parts = [
    card.name,
    card.variantNumber,
    card.type,
    card.super ?? '',
    card.variantType,
    card.setCode,
    card.rarity,
    ...card.colors,
  ];
  for (const printing of printings) {
    parts.push(printing.variantNumber, printing.variantLabel);
  }
  return parts.join(' ');
}

function compareBySort(a: CardListItem, b: CardListItem, sort: CatalogSort): number {
  const dir = sort.dir === 'desc' ? -1 : 1;
  switch (sort.sortBy) {
    case 'energy':
      return (a.energy - b.energy) * dir || a.name.localeCompare(b.name);
    case 'variantNumber':
      return (
        a.variantNumber.localeCompare(b.variantNumber) * dir ||
        a.name.localeCompare(b.name)
      );
    case 'price': {
      const diff = (getCardMaxMarketPrice(a) - getCardMaxMarketPrice(b)) * dir;
      return diff || a.name.localeCompare(b.name);
    }
    case 'releaseDate':
      return a.name.localeCompare(b.name) * dir;
    default:
      return a.name.localeCompare(b.name) * dir;
  }
}

/** Sort the full catalog (or any card list) by the active browse/search sort. */
export function sortCatalogItems(
  items: readonly CardListItem[],
  sort: CatalogSort,
  limit?: number
): CardListItem[] {
  const sorted = [...items].sort((left, right) => compareBySort(left, right, sort));
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function searchCatalogItems(
  items: readonly CardListItem[],
  query: string,
  sort: CatalogSort,
  limit?: number
): CardListItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matches = items.filter((card) =>
    matchesSearchHaystack(buildSearchBlob(card), trimmed)
  );

  const sorted = matches.slice().sort((a, b) => {
    if (sort.sortBy === 'price') {
      return compareBySort(a, b, sort);
    }
    const relevance =
      lexicalRelevanceScore(a, trimmed) - lexicalRelevanceScore(b, trimmed);
    if (relevance !== 0) return relevance;
    return compareBySort(a, b, sort);
  });

  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function featuredCatalogItems(
  items: readonly CardListItem[],
  limit = 12
): CardListItem[] {
  return sortCatalogItems(items, { sortBy: 'price', dir: 'desc' }, limit);
}
