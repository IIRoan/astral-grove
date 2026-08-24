import type { QueryClient } from '@tanstack/react-query';
import {
  RECENT_COLLECTION_ACTIVITY_LIMIT,
  type CollectionActivityEvent,
  type CollectionAuditActor,
} from '@riftbound/contracts';
import { collectionQueryKeys } from '@/src/api/queryKeys';

export type RecentActivitySnapshot = ReturnType<QueryClient['getQueriesData']>;

export function recentAddsQueryCoversVariant(
  queryKey: readonly unknown[],
  variantNumber: string
): boolean {
  if (queryKey[0] !== 'collection' || queryKey[1] !== 'recent-adds') return false;
  const encoded = queryKey[2];
  if (typeof encoded !== 'string' || encoded.length === 0) return false;
  return encoded.split(',').includes(variantNumber);
}

export function snapshotRecentActivityQueries(
  queryClient: QueryClient
): RecentActivitySnapshot {
  return queryClient.getQueriesData<CollectionActivityEvent[]>({
    queryKey: collectionQueryKeys.recentAddsRoot,
  });
}

export function restoreRecentActivityQueries(
  queryClient: QueryClient,
  snapshot: RecentActivitySnapshot | undefined
): void {
  if (!snapshot) return;
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
}

export function createOptimisticActivityEvent(input: {
  delta: number;
  quantityAfter: number;
  isFoil: boolean;
  actor: CollectionAuditActor;
  at?: Date;
}): CollectionActivityEvent {
  return {
    id: crypto.randomUUID(),
    at: (input.at ?? new Date()).toISOString(),
    action: input.delta > 0 ? 'add' : 'remove',
    quantityDelta: input.delta,
    quantityAfter: input.quantityAfter,
    isFoil: input.isFoil,
    actor: input.actor,
  };
}

/** Instantly prepend a quantity change onto any matching recent-adds caches. */
export function prependRecentActivity(
  queryClient: QueryClient,
  variantNumber: string,
  event: CollectionActivityEvent
): void {
  const queries = queryClient.getQueriesData<CollectionActivityEvent[]>({
    queryKey: collectionQueryKeys.recentAddsRoot,
  });
  for (const [queryKey, data] of queries) {
    if (!recentAddsQueryCoversVariant(queryKey, variantNumber)) continue;
    // Skip unresolved queries — `data ?? []` would seed a one-event list until staleTime.
    if (data === undefined) continue;
    queryClient.setQueryData(
      queryKey,
      [event, ...data].slice(0, RECENT_COLLECTION_ACTIVITY_LIMIT)
    );
  }
}

export function recordOptimisticCollectionActivity(
  queryClient: QueryClient,
  input: {
    variantNumber: string;
    previousQuantity: number;
    nextQuantity: number;
    isFoil: boolean;
    actor: CollectionAuditActor;
  }
): void {
  const delta = input.nextQuantity - input.previousQuantity;
  if (delta === 0) return;
  prependRecentActivity(
    queryClient,
    input.variantNumber,
    createOptimisticActivityEvent({
      delta,
      quantityAfter: Math.max(0, input.nextQuantity),
      isFoil: input.isFoil,
      actor: input.actor,
    })
  );
}
