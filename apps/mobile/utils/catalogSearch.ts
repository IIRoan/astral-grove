import {
  cardHasCost,
  lexicalRelevanceScore,
  matchesSearchHaystack,
  tokenizeSearchQuery,
  type CardListItem,
} from '@riftbound/contracts';
import type { CatalogSort } from '@/constants/catalogSort';
import { SET_DIRECTORY } from '@/constants/setDirectory';
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

/** Set codes whose name/code match the query — list items only carry setCode, not set name. */
export function setCodesMatchingSearchQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const codes: string[] = [];
  for (const set of SET_DIRECTORY) {
    if (matchesSearchHaystack(`${set.name} ${set.code}`, trimmed)) {
      codes.push(set.code.toUpperCase());
    }
  }
  return codes;
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

/** Cost sort mirrors the API: Legends/Battlefields have no cost to order by. */
function withoutNoCostForSort(
  items: readonly CardListItem[],
  sort: CatalogSort
): readonly CardListItem[] {
  return sort.sortBy === 'energy'
    ? items.filter((card) => cardHasCost(card.type))
    : items;
}

/** Sort the full catalog (or any card list) by the active browse/search sort. */
export function sortCatalogItems(
  items: readonly CardListItem[],
  sort: CatalogSort,
  limit?: number
): CardListItem[] {
  const sorted = [...withoutNoCostForSort(items, sort)].sort((left, right) =>
    compareBySort(left, right, sort)
  );
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

  const setCodes = new Set(setCodesMatchingSearchQuery(trimmed));
  const matches = withoutNoCostForSort(items, sort).filter((card) => {
    if (setCodes.has(card.setCode.trim().toUpperCase())) return true;
    return matchesSearchHaystack(buildSearchBlob(card), trimmed);
  });

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
