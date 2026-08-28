import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardsListResponse } from '@riftbound/contracts';
import { normalizeCardsListResponse } from '@/utils/variants';

const SEARCH_RESULTS_CACHE_KEY = 'riftbound_search_cache';
const MAX_CACHED_QUERIES = 12;
const CACHE_TTL_MS = 60 * 60 * 1000;

type CachedSearchEntry = {
  query: string;
  cachedAt: number;
  response: CardsListResponse;
};

export const MIN_SEARCH_LENGTH = 2;

async function readResultsCache(): Promise<CachedSearchEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_RESULTS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CachedSearchEntry[];
  } catch {
    return [];
  }
}

export async function getCachedSearchResults(
  query: string
): Promise<CardsListResponse | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const entries = await readResultsCache();
  const hit = entries.find((e) => e.query === key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > CACHE_TTL_MS) return null;
  return normalizeCardsListResponse(hit.response);
}

export async function cacheSearchResults(
  query: string,
  response: CardsListResponse
): Promise<void> {
  const key = query.trim().toLowerCase();
  if (key.length < MIN_SEARCH_LENGTH) return;
  if (response.data.length === 0) return;

  const entries = (await readResultsCache()).filter((e) => e.query !== key);
  entries.unshift({
    query: key,
    cachedAt: Date.now(),
    response: normalizeCardsListResponse(response),
  });
  await AsyncStorage.setItem(
    SEARCH_RESULTS_CACHE_KEY,
    JSON.stringify(entries.slice(0, MAX_CACHED_QUERIES))
  );
}
