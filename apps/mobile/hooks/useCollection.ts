import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { CardListItem, CollectionActivityEvent } from '@riftbound/contracts';
import { useMemo } from 'react';
import {
  addDetailToCollection,
  addToCollection,
  adjustCollectionQuantity,
  getCollection,
  removeFromCollection,
  removeManyFromCollection,
  updateCollectionQuantity,
  type CollectionEntry,
} from '@/services/collectionService';
import {
  persistCollection,
  readPersistedCollection,
} from '@/services/collectionCacheService';
import { fetchRemoteCollectionQuantities } from '@/services/remoteCollectionService';
import { useCollectionShareStatus } from '@/hooks/useCollectionShare';
import { collectionMutationKey, collectionQueryKeys } from '@/src/api/queryKeys';
import {
  bumpCollectionMutationGeneration,
  collectionSnapshotIsStale,
  getCollectionMutationGeneration,
} from '@/hooks/collectionMutationGeneration';
import {
  findVariantByNumber,
  getCardPrintings,
  isFoilVariant,
  variantNumbersMatch,
} from '@/utils/variants';
import {
  mergeOwnershipFromCollection,
  mergeOwnershipRecords,
  ownershipMapFromRecord,
  ownershipRecordFromQuantityRows,
  type CollectionOwnershipMap,
} from '@/utils/collectionOwnership';
import { authClient } from '@/src/lib/auth-client';
import {
  recordOptimisticCollectionActivity,
  recentAddsQueryCoversVariant,
} from '@/lib/collection-recent-activity';
import {
  getOwnershipRecord,
  type CollectionEntrySeed,
} from '@/lib/collection-optimistic-cache';
import {
  applyOptimisticCollectionQuantity,
  beginOptimisticCollectionMutation,
  collectionCachedQuantity,
  rollbackOptimisticCollectionMutation,
  settleOptimisticCollectionMutation,
  type CollectionOptimisticMutation,
} from '@/lib/collection-mutation-cache';

const COLLECTION_STALE_MS = 5 * 60 * 1000;
const OWNERSHIP_STALE_MS = 5 * 60 * 1000;
/** Shared collections stay fresher via SSE; focus/mount refetch is a safety net. */
const SHARED_COLLECTION_STALE_MS = 30_000;

type OwnershipRecord = Record<string, number>;

export { getOwnershipRecord };

export function syncOwnershipFromCollection(
  queryClient: QueryClient,
  entries: readonly CollectionEntry[]
) {
  const merged = mergeOwnershipFromCollection(getOwnershipRecord(queryClient), entries);
  queryClient.setQueryData(collectionQueryKeys.ownershipRoot, merged);
  queryClient.setQueriesData<OwnershipRecord>(
    { queryKey: collectionQueryKeys.ownershipRoot },
    () => merged
  );
}

export async function hydrateCollectionCache(queryClient: QueryClient): Promise<void> {
  const cached = await readPersistedCollection();
  if (!cached?.length) return;
  if (!queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all)) {
    queryClient.setQueryData(collectionQueryKeys.all, cached);
  }
  syncOwnershipFromCollection(queryClient, cached);
}

async function fetchCollectionQuery(
  queryClient: QueryClient
): Promise<CollectionEntry[]> {
  const generation = getCollectionMutationGeneration(queryClient);
  const startedDuringMutation =
    queryClient.isMutating({ mutationKey: collectionMutationKey }) > 0;
  const entries = await getCollection();
  if (collectionSnapshotIsStale(queryClient, generation, startedDuringMutation)) {
    return (
      queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? entries
    );
  }
  syncOwnershipFromCollection(queryClient, entries);
  void persistCollection(entries);
  return entries;
}

export function prefetchCollection(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => fetchCollectionQuery(queryClient),
    staleTime: COLLECTION_STALE_MS,
  });
}

export function useCollection(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const signedIn = Boolean(authClient.useSession().data?.user);
  const shareStatus = useCollectionShareStatus(options?.enabled ?? true);
  const isShared = shareStatus.data?.shared === true;

  return useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => fetchCollectionQuery(queryClient),
    staleTime: isShared ? SHARED_COLLECTION_STALE_MS : COLLECTION_STALE_MS,
    refetchOnWindowFocus: isShared,
    refetchOnReconnect: isShared,
    refetchOnMount: isShared,
    enabled: (options?.enabled ?? true) && signedIn,
  });
}

export function useCollectionOwnership(variantNumbers: readonly string[]): {
  collectionByVariant: CollectionOwnershipMap;
  isLoading: boolean;
} {
  const queryClient = useQueryClient();
  const signedIn = Boolean(authClient.useSession().data?.user);
  const shareStatus = useCollectionShareStatus();
  const isShared = shareStatus.data?.shared === true;
  const normalized = useMemo(
    () => [...new Set(variantNumbers.filter(Boolean))].sort(),
    [variantNumbers]
  );

  const ownershipQuery = useQuery({
    queryKey: collectionQueryKeys.ownership(normalized),
    queryFn: async () => {
      const cached = getOwnershipRecord(queryClient);
      const missing = normalized.filter(
        (variantNumber) => cached[variantNumber] === undefined
      );
      const toFetch = isShared ? normalized : missing;
      if (toFetch.length === 0) return cached;

      const generation = getCollectionMutationGeneration(queryClient);
      const startedDuringMutation =
        queryClient.isMutating({ mutationKey: collectionMutationKey }) > 0;
      const rows = await fetchRemoteCollectionQuantities(toFetch);
      if (collectionSnapshotIsStale(queryClient, generation, startedDuringMutation)) {
        return getOwnershipRecord(queryClient);
      }
      // Re-read after await: don't clobber newer optimistic values on cold fills; shared refresh takes server truth unless a mutation is in flight.
      const cachedNow = getOwnershipRecord(queryClient);
      const mutating =
        queryClient.isMutating({ mutationKey: collectionMutationKey }) > 0;
      const serverRecord = ownershipRecordFromQuantityRows(rows);
      const patch: OwnershipRecord = {};
      for (const [key, quantity] of Object.entries(serverRecord)) {
        if (cachedNow[key] !== undefined && (!isShared || mutating)) {
          continue;
        }
        patch[key] = quantity;
      }
      const merged = mergeOwnershipRecords(cachedNow, patch);
      queryClient.setQueryData(collectionQueryKeys.ownershipRoot, merged);
      queryClient.setQueriesData<OwnershipRecord>(
        { queryKey: collectionQueryKeys.ownershipRoot },
        () => merged
      );
      return merged;
    },
    placeholderData: () => {
      const cached = getOwnershipRecord(queryClient);
      const hasAll = normalized.every(
        (variantNumber) => cached[variantNumber] !== undefined
      );
      return hasAll ? cached : undefined;
    },
    enabled: normalized.length > 0 && signedIn,
    staleTime: isShared ? SHARED_COLLECTION_STALE_MS : OWNERSHIP_STALE_MS,
    refetchOnWindowFocus: isShared,
    refetchOnReconnect: isShared,
    refetchOnMount: isShared,
  });

  const ownership = ownershipQuery.data ?? getOwnershipRecord(queryClient);
  const collectionByVariant = useMemo(
    () => ownershipMapFromRecord(ownership),
    [ownership]
  );

  return {
    collectionByVariant,
    isLoading: ownershipQuery.isLoading,
  };
}

interface CollectionMutationContext {
  optimistic: CollectionOptimisticMutation;
  optimisticActivityIds: Set<string>;
}

function recordMutationActivity(
  queryClient: QueryClient,
  context: CollectionMutationContext,
  input: Parameters<typeof recordOptimisticCollectionActivity>[1]
) {
  const before = new Set(
    queryClient
      .getQueriesData<CollectionActivityEvent[]>({
        queryKey: collectionQueryKeys.recentAddsRoot,
        predicate: (query) =>
          recentAddsQueryCoversVariant(query.queryKey, input.variantNumber),
      })
      .flatMap(([, data]) => data?.map((event) => event.id) ?? [])
  );
  recordOptimisticCollectionActivity(queryClient, input);
  for (const [, events] of queryClient.getQueriesData<CollectionActivityEvent[]>({
    queryKey: collectionQueryKeys.recentAddsRoot,
    predicate: (query) =>
      recentAddsQueryCoversVariant(query.queryKey, input.variantNumber),
  })) {
    for (const event of events ?? []) {
      if (!before.has(event.id)) context.optimisticActivityIds.add(event.id);
    }
  }
}

function invalidateRecentAdds(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: collectionQueryKeys.recentAddsRoot,
  });
}

function invalidateCollection(queryClient: QueryClient) {
  // exact: don't also stale ownership slices (re-POSTs /quantities on every +/-).
  void queryClient.invalidateQueries({
    queryKey: collectionQueryKeys.all,
    exact: true,
  });
  void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.ownershipRoot });
  invalidateRecentAdds(queryClient);
}

/** Persist optimistic collection state without refetching the full list. */
function commitCollectionLocal(queryClient: QueryClient) {
  queueMicrotask(() => {
    const entries =
      queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
    void persistCollection(entries);
  });
}

function reconcileCollectionEntries(
  queryClient: QueryClient,
  context: CollectionMutationContext | undefined
) {
  if (!context) return;
  const variantNumbers = settleOptimisticCollectionMutation(
    queryClient,
    context.optimistic
  );
  if (variantNumbers) {
    // TanStack calls onSettled before marking the last mutation complete.
    setTimeout(() => {
      invalidateCollection(queryClient);
      for (const variantNumber of variantNumbers) {
        void queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.entry(variantNumber),
          exact: true,
        });
      }
    }, 0);
    return;
  }
  commitCollectionLocal(queryClient);
}

/** Snapshot + cancel without awaiting — awaiting cancelQueries before setQueryData lagged Add ~0.5s. */
function beginCollectionMutation(
  queryClient: QueryClient,
  variantNumber: string
): CollectionMutationContext {
  bumpCollectionMutationGeneration(queryClient);
  const context: CollectionMutationContext = {
    optimistic: beginOptimisticCollectionMutation(queryClient),
    optimisticActivityIds: new Set(),
  };
  void queryClient.cancelQueries({ queryKey: collectionQueryKeys.all, exact: true });
  void queryClient.cancelQueries({
    queryKey: collectionQueryKeys.entry(variantNumber),
  });
  // Cancel in-flight /quantities so stale responses cannot overwrite optimistic ownership.
  void queryClient.cancelQueries({ queryKey: collectionQueryKeys.ownershipRoot });
  void queryClient.cancelQueries({ queryKey: collectionQueryKeys.recentAddsRoot });
  return context;
}

function rollbackCollectionCache(
  queryClient: QueryClient,
  context?: CollectionMutationContext
) {
  if (!context) return;
  rollbackOptimisticCollectionMutation(queryClient, context.optimistic);
  for (const [key, events] of queryClient.getQueriesData<CollectionActivityEvent[]>({
    queryKey: collectionQueryKeys.recentAddsRoot,
    predicate: (query) =>
      context.optimistic.changes.some((change) =>
        recentAddsQueryCoversVariant(query.queryKey, change.variantNumber)
      ),
  })) {
    if (!events?.some((event) => context.optimisticActivityIds.has(event.id))) continue;
    queryClient.setQueryData(
      key,
      events.filter((event) => !context.optimisticActivityIds.has(event.id))
    );
  }
}

function entrySeedFromListCard(
  card: CardListItem,
  variantNumber: string,
  isFoil?: boolean
): CollectionEntrySeed | null {
  const printings = getCardPrintings(card);
  const printing =
    (isFoil === undefined
      ? undefined
      : printings.find(
          (item) =>
            variantNumbersMatch(item.variantNumber, variantNumber) &&
            item.isFoil === isFoil
        )) ??
    printings.find((item) => variantNumbersMatch(item.variantNumber, variantNumber)) ??
    printings[0];
  if (!printing) return null;

  return {
    name: card.name,
    imageUrl: card.imageUrl,
    setCode: card.setCode,
    rarity: card.rarity,
    type: card.type,
    variantLabel: printing.variantLabel,
    isFoil: printing.isFoil,
  };
}

function entrySeedFromDetailCard(
  card: Parameters<typeof addDetailToCollection>[0],
  variantNumber: string,
  isFoil?: boolean
): CollectionEntrySeed | null {
  const variant = findVariantByNumber(card.variants, variantNumber);
  if (!variant) return null;
  const foil =
    isFoil ??
    isFoilVariant(
      variant.variantNumber,
      variant.variantLabel,
      variant.variantType,
      'foilMode' in variant ? (variant.foilMode as string | undefined) : undefined
    );

  return {
    name: card.name,
    imageUrl: variant.imageUrl,
    setCode: variant.variantNumber.split('-')[0] ?? '',
    rarity: variant.rarity,
    type: card.type,
    variantLabel: variant.variantLabel,
    isFoil: foil,
  };
}

export function useCollectionMutations() {
  const queryClient = useQueryClient();
  const sessionQuery = authClient.useSession();
  const actor = {
    userId: sessionQuery.data?.user.id ?? 'local',
    name: sessionQuery.data?.user.name ?? null,
    email: sessionQuery.data?.user.email ?? null,
  };

  const addCard = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.add' },
    mutationFn: (input: {
      card: CardListItem;
      variantNumber?: string;
      isFoil?: boolean;
    }) =>
      addToCollection(input.card, {
        variantNumber: input.variantNumber,
        isFoil: input.isFoil,
      }),
    onMutate: (vars) => {
      const variantNumber = vars.variantNumber ?? vars.card.variantNumber;
      const printings = getCardPrintings(vars.card);
      const printing =
        (vars.isFoil === undefined
          ? undefined
          : printings.find(
              (p) =>
                variantNumbersMatch(p.variantNumber, variantNumber) &&
                p.isFoil === vars.isFoil
            )) ??
        printings.find((p) => variantNumbersMatch(p.variantNumber, variantNumber)) ??
        printings[0];
      const isFoil = vars.isFoil ?? printing?.isFoil ?? false;
      const context = beginCollectionMutation(queryClient, variantNumber);
      const previousQuantity = collectionCachedQuantity(
        queryClient,
        variantNumber,
        isFoil
      );
      const nextQuantity = previousQuantity + 1;
      const seed = entrySeedFromListCard(vars.card, variantNumber, isFoil) ?? undefined;
      applyOptimisticCollectionQuantity(
        queryClient,
        context.optimistic,
        variantNumber,
        nextQuantity,
        seed,
        isFoil,
        true
      );
      recordMutationActivity(queryClient, context, {
        variantNumber,
        previousQuantity,
        nextQuantity,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, _vars, context) => {
      rollbackCollectionCache(queryClient, context);
    },
    onSettled: (_data, _error, _vars, context) => {
      reconcileCollectionEntries(queryClient, context);
    },
  });

  const addFromDetail = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.add_detail' },
    mutationFn: (input: {
      card: Parameters<typeof addDetailToCollection>[0];
      variantNumber: string;
      isFoil?: boolean;
    }) => addDetailToCollection(input.card, input.variantNumber, 1, input.isFoil),
    onMutate: (vars) => {
      const derivedIsFoil =
        vars.isFoil ??
        (() => {
          const variant = findVariantByNumber(vars.card.variants, vars.variantNumber);
          if (!variant) return false;
          return isFoilVariant(
            variant.variantNumber,
            variant.variantLabel,
            variant.variantType,
            'foilMode' in variant ? (variant.foilMode as string | undefined) : undefined
          );
        })();
      const context = beginCollectionMutation(queryClient, vars.variantNumber);
      const previousQuantity = collectionCachedQuantity(
        queryClient,
        vars.variantNumber,
        derivedIsFoil
      );
      const nextQuantity = previousQuantity + 1;
      const seed =
        entrySeedFromDetailCard(vars.card, vars.variantNumber, derivedIsFoil) ??
        undefined;
      applyOptimisticCollectionQuantity(
        queryClient,
        context.optimistic,
        vars.variantNumber,
        nextQuantity,
        seed,
        derivedIsFoil,
        true
      );
      recordMutationActivity(queryClient, context, {
        variantNumber: vars.variantNumber,
        previousQuantity,
        nextQuantity,
        isFoil: derivedIsFoil,
        actor,
      });
      return context;
    },
    onError: (_error, _vars, context) => {
      rollbackCollectionCache(queryClient, context);
    },
    onSettled: (_data, _error, _vars, context) => {
      reconcileCollectionEntries(queryClient, context);
    },
  });

  const setQuantity = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.set_quantity' },
    mutationFn: ({
      variantNumber,
      quantity,
      isFoil,
    }: {
      variantNumber: string;
      quantity: number;
      isFoil?: boolean;
    }) => updateCollectionQuantity(variantNumber, quantity, isFoil),
    onMutate: (vars) => {
      const isFoil = vars.isFoil ?? false;
      const context = beginCollectionMutation(queryClient, vars.variantNumber);
      const previousQuantity = collectionCachedQuantity(
        queryClient,
        vars.variantNumber,
        isFoil
      );
      applyOptimisticCollectionQuantity(
        queryClient,
        context.optimistic,
        vars.variantNumber,
        vars.quantity,
        undefined,
        isFoil
      );
      recordMutationActivity(queryClient, context, {
        variantNumber: vars.variantNumber,
        previousQuantity,
        nextQuantity: vars.quantity,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, _vars, context) => {
      rollbackCollectionCache(queryClient, context);
    },
    onSettled: (_data, _error, _vars, context) => {
      reconcileCollectionEntries(queryClient, context);
    },
  });

  const adjustQuantity = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.adjust_quantity' },
    mutationFn: ({
      variantNumber,
      delta,
      isFoil,
    }: {
      variantNumber: string;
      delta: number;
      isFoil?: boolean;
    }) => adjustCollectionQuantity(variantNumber, delta, isFoil),
    onMutate: (vars) => {
      const isFoil = vars.isFoil ?? false;
      const context = beginCollectionMutation(queryClient, vars.variantNumber);
      const previousQuantity = collectionCachedQuantity(
        queryClient,
        vars.variantNumber,
        isFoil
      );
      const nextQuantity = previousQuantity + vars.delta;
      applyOptimisticCollectionQuantity(
        queryClient,
        context.optimistic,
        vars.variantNumber,
        nextQuantity,
        undefined,
        isFoil,
        true
      );
      recordMutationActivity(queryClient, context, {
        variantNumber: vars.variantNumber,
        previousQuantity,
        nextQuantity,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, _vars, context) => {
      rollbackCollectionCache(queryClient, context);
    },
    onSettled: (_data, _error, _vars, context) => {
      reconcileCollectionEntries(queryClient, context);
    },
  });

  const removeCard = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.remove' },
    mutationFn: (input: string | { variantNumber: string; isFoil?: boolean }) => {
      const variantNumber = typeof input === 'string' ? input : input.variantNumber;
      const isFoil = typeof input === 'string' ? undefined : input.isFoil;
      return removeFromCollection(variantNumber, isFoil);
    },
    onMutate: (input) => {
      const variantNumber = typeof input === 'string' ? input : input.variantNumber;
      const isFoil = typeof input === 'string' ? false : (input.isFoil ?? false);
      const context = beginCollectionMutation(queryClient, variantNumber);
      const previousQuantity = collectionCachedQuantity(
        queryClient,
        variantNumber,
        isFoil
      );
      applyOptimisticCollectionQuantity(
        queryClient,
        context.optimistic,
        variantNumber,
        0,
        undefined,
        isFoil
      );
      recordMutationActivity(queryClient, context, {
        variantNumber,
        previousQuantity,
        nextQuantity: 0,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, _vars, context) => {
      rollbackCollectionCache(queryClient, context);
    },
    onSettled: (_data, _error, _vars, context) => {
      reconcileCollectionEntries(queryClient, context);
    },
  });

  const removeMany = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.remove_many' },
    mutationFn: (variantNumbers: string[]) => removeManyFromCollection(variantNumbers),
    onMutate: (variantNumbers) => {
      const context = beginCollectionMutation(queryClient, variantNumbers[0] ?? '');
      for (const variantNumber of variantNumbers) {
        applyOptimisticCollectionQuantity(
          queryClient,
          context.optimistic,
          variantNumber,
          0,
          undefined,
          false
        );
        applyOptimisticCollectionQuantity(
          queryClient,
          context.optimistic,
          variantNumber,
          0,
          undefined,
          true
        );
        void queryClient.cancelQueries({
          queryKey: collectionQueryKeys.entry(variantNumber),
          exact: true,
        });
      }
      return context;
    },
    onError: (_error, _variantNumbers, context) => {
      rollbackCollectionCache(queryClient, context);
    },
    onSettled: (_data, _error, _variantNumbers, context) => {
      reconcileCollectionEntries(queryClient, context);
    },
  });

  return {
    addCard,
    addFromDetail,
    setQuantity,
    adjustQuantity,
    removeCard,
    removeMany,
  };
}

export type { CollectionEntry };
