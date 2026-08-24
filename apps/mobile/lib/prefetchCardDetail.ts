import type { QueryClient } from '@tanstack/react-query';
import type { CardDetail, CardListItem } from '@riftbound/contracts';
import { chunkArray } from '@riftbound/contracts';
import { prefetchCatalogArt } from '@/lib/imagePrefetch';
import { api } from '@/src/api/client';
import { cardQueryKeys, catalogQueryKeys } from '@/src/api/queryKeys';

const DETAIL_STALE_MS = 5 * 60 * 1000;
/** Coalesce bursts from list mount + viewability into one batch POST. */
const BATCH_FLUSH_MS = 16;
const MAX_BATCH = 100;

type CardDetailCacheEntry = {
  data: CardDetail;
  meta: {
    source: 'cache' | 'upstream' | 'cache-refreshed';
    contentHash: string;
  };
};

type PendingPrefetch = {
  queryClient: QueryClient;
  variantNumbers: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
};

let pending: PendingPrefetch | null = null;
let flushChain: Promise<void> = Promise.resolve();

function prefetchCardImage(item: CardListItem): void {
  // Tiles paint ?w=160 first — warm that URI or cells still shimmer while full loads.
  prefetchCatalogArt([item], { limit: 1, includeFull: true });
}

const LIST_PLACEHOLDER_HASH = 'list-placeholder';

/** True for real detail payloads (incl. empty rules text); list-row placeholders are not hydrated. */
export function isHydratedDetail(entry: CardDetailCacheEntry | undefined): boolean {
  if (!entry?.data) return false;
  if (entry.meta.contentHash === LIST_PLACEHOLDER_HASH) return false;
  return typeof entry.data.description === 'string';
}

function needsDetailPrefetch(
  queryClient: QueryClient,
  variantNumber: string,
  options?: { ignoreInFlight?: boolean }
): boolean {
  const state = queryClient.getQueryState<CardDetailCacheEntry>(
    cardQueryKeys.detail(variantNumber)
  );
  if (!state) return true;
  if (!options?.ignoreInFlight && state.fetchStatus === 'fetching') return false;
  if (state.data && !state.isInvalidated) {
    // List placeholders / incomplete seeds must still be fetched.
    if (!isHydratedDetail(state.data)) return true;
    return Date.now() - state.dataUpdatedAt >= DETAIL_STALE_MS;
  }
  return true;
}

function seedDetailCache(
  queryClient: QueryClient,
  variantNumber: string,
  card: CardDetail,
  source: CardDetailCacheEntry['meta']['source']
): void {
  const key = cardQueryKeys.detail(variantNumber);
  const existing = queryClient.getQueryState<CardDetailCacheEntry>(key);
  if (existing?.data && isHydratedDetail(existing.data) && !existing.isInvalidated) {
    if (Date.now() - existing.dataUpdatedAt < DETAIL_STALE_MS) return;
  }

  const payload: CardDetailCacheEntry = {
    data: card,
    meta: { source, contentHash: 'batch-prefetch' },
  };
  queryClient.setQueryData(key, payload);
}

function mapBatchSource(
  source: 'cache' | 'mixed' | 'upstream'
): CardDetailCacheEntry['meta']['source'] {
  if (source === 'upstream') return 'upstream';
  return 'cache';
}

function seedCardDetailResponse(
  queryClient: QueryClient,
  response: Awaited<ReturnType<typeof api.getCard>>,
  source: CardDetailCacheEntry['meta']['source']
): CardDetailCacheEntry {
  const payload: CardDetailCacheEntry = {
    data: response.data,
    meta: {
      source,
      contentHash: response.meta.contentHash ?? 'detail-fetch',
    },
  };
  for (const variant of response.data.variants) {
    seedDetailCache(queryClient, variant.variantNumber, response.data, source);
  }
  return payload;
}

async function runBatchPrefetch(
  queryClient: QueryClient,
  variantNumbers: string[]
): Promise<void> {
  const missing = variantNumbers.filter((variantNumber) =>
    needsDetailPrefetch(queryClient, variantNumber, { ignoreInFlight: true })
  );
  if (missing.length === 0) return;

  await Promise.all(
    chunkArray(missing, MAX_BATCH).map(async (batch) => {
      const requested = new Set(batch);
      const response = await api.batchCards(batch);
      const source = mapBatchSource(response.meta.source);

      for (const card of response.data) {
        const hit = card.variants.some((variant) =>
          requested.has(variant.variantNumber)
        );
        if (!hit) continue;
        for (const variant of card.variants) {
          seedDetailCache(queryClient, variant.variantNumber, card, source);
        }
      }
    })
  );
}

function scheduleFlush(queryClient: QueryClient): void {
  if (!pending) {
    pending = { queryClient, variantNumbers: new Set(), timer: null };
  } else {
    pending.queryClient = queryClient;
  }

  if (pending.timer != null) return;

  pending.timer = setTimeout(() => {
    const snapshot = pending;
    pending = null;
    if (!snapshot || snapshot.variantNumbers.size === 0) return;

    const variants = [...snapshot.variantNumbers];
    flushChain = flushChain
      .then(() => runBatchPrefetch(snapshot.queryClient, variants))
      .catch(() => {
        // Prefetch is best-effort; detail views still fetch on demand.
      });
  }, BATCH_FLUSH_MS);
}

/** Warm the detail query and image cache for a catalog list row. */
export function prefetchCardDetail(queryClient: QueryClient, item: CardListItem): void {
  prefetchCardImage(item);

  const { variantNumber } = item;
  if (!variantNumber || !needsDetailPrefetch(queryClient, variantNumber)) return;

  scheduleFlush(queryClient);
  pending?.variantNumbers.add(variantNumber);
}

/** Fetch full detail immediately — does not wait on the background batch queue. */
export async function fetchCardDetailNow(
  queryClient: QueryClient,
  variantNumber: string
): Promise<CardDetailCacheEntry> {
  const key = cardQueryKeys.detail(variantNumber);
  const cached = queryClient.getQueryData<CardDetailCacheEntry>(key);
  if (isHydratedDetail(cached)) return cached!;

  const response = await api.getCard(variantNumber);
  const payload = seedCardDetailResponse(queryClient, response, 'upstream');
  queryClient.setQueryData(key, payload);
  return payload;
}

/** Fire-and-forget: start description fetch as soon as the user taps a card. */
export function ensureCardDetail(
  queryClient: QueryClient,
  variantNumber: string
): void {
  if (!variantNumber) return;
  const cached = queryClient.getQueryData<CardDetailCacheEntry>(
    cardQueryKeys.detail(variantNumber)
  );
  if (isHydratedDetail(cached)) return;

  void queryClient.prefetchQuery({
    queryKey: cardQueryKeys.detail(variantNumber),
    queryFn: () => fetchCardDetailNow(queryClient, variantNumber),
    staleTime: DETAIL_STALE_MS,
  });
}

/** Resolve a list row from the catalog index for instant detail chrome. */
export function findCachedCardListItem(
  queryClient: QueryClient,
  variantNumber: string
): CardListItem | undefined {
  if (!variantNumber) return undefined;
  const index = queryClient.getQueryData<{ items: CardListItem[] }>(
    catalogQueryKeys.index
  );
  const items = index?.items;
  if (!items?.length) return undefined;

  for (const item of items) {
    if (item.variantNumber === variantNumber) return item;
    if (item.printings?.some((printing) => printing.variantNumber === variantNumber)) {
      return item;
    }
  }
  return undefined;
}

/** Flush any queued detail prefetches (tests / urgent select paths). */
export async function flushCardDetailPrefetch(): Promise<void> {
  if (pending?.timer != null) {
    clearTimeout(pending.timer);
    pending.timer = null;
  }

  const snapshot = pending;
  pending = null;
  if (snapshot && snapshot.variantNumbers.size > 0) {
    flushChain = flushChain
      .then(() => runBatchPrefetch(snapshot.queryClient, [...snapshot.variantNumbers]))
      .catch(() => undefined);
  }

  await flushChain;
}

/** Test helper — clears the in-flight coalesce queue. */
export function resetCardDetailPrefetchQueue(): void {
  if (pending?.timer != null) {
    clearTimeout(pending.timer);
  }
  pending = null;
  flushChain = Promise.resolve();
}
