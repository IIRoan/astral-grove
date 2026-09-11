import type { CardListItem, CardsListResponse } from '@riftbound/contracts';

export function paginateLocalCardSearch(
  items: readonly CardListItem[],
  page: number,
  pageSize: number
): { items: CardListItem[]; loadedItems: CardListItem[]; hasNextPage: boolean } {
  const size = Math.max(1, pageSize);
  const currentPage = Math.max(1, page);
  const start = (currentPage - 1) * size;
  const end = start + size;
  return {
    items: items.slice(start, end),
    loadedItems: items.slice(0, end),
    hasNextPage: items.length > end,
  };
}

export function localCardSearchMeta(
  total: number,
  page: number,
  pageSize: number
): CardsListResponse['meta'] {
  const size = Math.max(1, pageSize);
  const currentPage = Math.max(1, page);
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    pagination: {
      total,
      page: currentPage,
      limit: size,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1,
    },
    source: 'cache',
    catalogHash: '',
  };
}

export function pickCardSearchRawItems(args: {
  hasApiItems: boolean;
  apiItems: CardListItem[];
  inputMatchesActive: boolean;
  instantCacheItems: CardListItem[];
  localItems: CardListItem[];
  isFetching: boolean;
}): CardListItem[] {
  const {
    hasApiItems,
    apiItems,
    inputMatchesActive,
    instantCacheItems,
    localItems,
    isFetching,
  } = args;

  if (hasApiItems && inputMatchesActive) return apiItems;
  if (localItems.length > 0) return localItems;
  if (!inputMatchesActive) {
    return instantCacheItems.length > 0 ? instantCacheItems : apiItems;
  }
  if (isFetching && instantCacheItems.length === 0) return [];
  return instantCacheItems.length > 0 ? instantCacheItems : apiItems;
}
