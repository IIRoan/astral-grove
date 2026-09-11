import { SEARCH_NORMALIZATION_VERSION } from '@riftbound/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardsListResponse } from '@riftbound/contracts';
import { catalogFiltersQueryKey } from '@/constants/catalogFilters';
import type { CatalogFilters } from '@/constants/catalogFilters';
import type { CatalogSort } from '@/constants/catalogSort';
import { normalizeCardsListResponse } from '@/utils/variants';

const SEARCH_RESULTS_CACHE_KEY = `riftbound_search_cache_norm-${SEARCH_NORMALIZATION_VERSION}`;
const MAX_CACHED_QUERIES = 12;
const CACHE_TTL_MS = 60 * 60 * 1000;

type CachedSearchEntry = {
  cacheKey: string;
  cachedAt: number;
  response: CardsListResponse;
};

export const MIN_SEARCH_LENGTH = 2;

export type SearchResultsCacheScope = {
  sort: CatalogSort;
  filters: CatalogFilters;
  limit: number;
};

export function searchResultsCacheKey(
  query: string,
  scope: SearchResultsCacheScope
): string {
  const term = query.trim().toLowerCase();
  return [
    term,
    scope.sort.sortBy,
    scope.sort.dir,
    String(scope.limit),
    catalogFiltersQueryKey(scope.filters),
  ].join('|');
}

async function readResultsCache(): Promise<CachedSearchEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_RESULTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedSearchEntry[];
    return parsed.filter((entry) => typeof entry.cacheKey === 'string');
  } catch {
    return [];
  }
}

export async function getCachedSearchResults(
  query: string,
  scope: SearchResultsCacheScope
): Promise<CardsListResponse | null> {
  if (query.trim().length < MIN_SEARCH_LENGTH) return null;
  const key = searchResultsCacheKey(query, scope);

  const entries = await readResultsCache();
  const hit = entries.find((e) => e.cacheKey === key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > CACHE_TTL_MS) return null;
  return normalizeCardsListResponse(hit.response);
}

export async function cacheSearchResults(
  query: string,
  scope: SearchResultsCacheScope,
  response: CardsListResponse
): Promise<void> {
  const key = searchResultsCacheKey(query, scope);
  if (query.trim().length < MIN_SEARCH_LENGTH) return;
  if (response.data.length === 0) return;

  const entries = (await readResultsCache()).filter((e) => e.cacheKey !== key);
  entries.unshift({
    cacheKey: key,
    cachedAt: Date.now(),
    response: normalizeCardsListResponse(response),
  });
  await AsyncStorage.setItem(
    SEARCH_RESULTS_CACHE_KEY,
    JSON.stringify(entries.slice(0, MAX_CACHED_QUERIES))
  );
}
