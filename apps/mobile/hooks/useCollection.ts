import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { collectionFinishKey, type CardListItem } from '@riftbound/contracts';
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
  restoreRecentActivityQueries,
  snapshotRecentActivityQueries,
  type RecentActivitySnapshot,
} from '@/lib/collection-recent-activity';

const COLLECTION_STALE_MS = 5 * 60 * 1000;
const OWNERSHIP_STALE_MS = 5 * 60 * 1000;
/** Shared collections stay fresher via SSE; focus/mount refetch is a safety net. */
const SHARED_COLLECTION_STALE_MS = 30_000;

type OwnershipRecord = Record<string, number>;

export function getOwnershipRecord(queryClient: QueryClient): OwnershipRecord {
  return (
    queryClient.getQueryData<OwnershipRecord>(collectionQueryKeys.ownershipRoot) ?? {}
  );
}

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

function setOwnershipQuantity(
  queryClient: QueryClient,
  variantNumber: string,
  quantity: number,
  isFoil = false
) {
  const current = getOwnershipRecord(queryClient);
  const finishKey = collectionFinishKey(variantNumber, isFoil);
  const otherFinishKey = collectionFinishKey(variantNumber, !isFoil);
  const otherQty = current[otherFinishKey] ?? 0;
  const merged = mergeOwnershipRecords(current, {
    [finishKey]: quantity,
    [variantNumber]: quantity + otherQty,
  });
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
  await persistCollection(entries);
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
  const shareStatus = useCollectionShareStatus(options?.enabled ?? true);
  const isShared = shareStatus.data?.shared === true;

  return useQuery({
    queryKey: collectionQueryKeys.all,
    queryFn: () => fetchCollectionQuery(queryClient),
    staleTime: isShared ? SHARED_COLLECTION_STALE_MS : COLLECTION_STALE_MS,
    refetchOnWindowFocus: isShared,
    refetchOnReconnect: isShared,
    refetchOnMount: isShared,
    enabled: options?.enabled ?? true,
  });
}

export function useCollectionOwnership(variantNumbers: readonly string[]): {
  collectionByVariant: CollectionOwnershipMap;
  isLoading: boolean;
} {
  const queryClient = useQueryClient();
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
    enabled: normalized.length > 0,
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

type CollectionEntrySeed = Omit<
  CollectionEntry,
  'quantity' | 'addedAt' | 'updatedAt' | 'variantNumber'
>;

interface CollectionMutationContext {
  previousAll?: CollectionEntry[];
  previousEntry?: CollectionEntry | null | undefined;
  previousEntries?: Map<string, CollectionEntry | null | undefined>;
  previousOwnership?: OwnershipRecord;
  previousRecentAdds?: RecentActivitySnapshot;
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
  const entries =
    queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
  void persistCollection(entries);
}

function reconcileCollectionEntries(
  queryClient: QueryClient,
  variantNumbers: string[],
  error: unknown
) {
  if (error) {
    // Rollback already restored cache; pull server truth once.
    invalidateCollection(queryClient);
    for (const variantNumber of variantNumbers) {
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.entry(variantNumber),
      });
    }
    return;
  }

  commitCollectionLocal(queryClient);
  // onMutate cancel aborts first fetch — refetch so the log isn't empty/synthetic until staleTime.
  invalidateRecentAdds(queryClient);
}

/** Snapshot + cancel without awaiting — awaiting cancelQueries before setQueryData lagged Add ~0.5s. */
function beginCollectionMutation(
  queryClient: QueryClient,
  variantNumber: string
): CollectionMutationContext {
  bumpCollectionMutationGeneration(queryClient);
  const context: CollectionMutationContext = {
    previousAll: queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all),
    previousEntry: queryClient.getQueryData<CollectionEntry | null>(
      collectionQueryKeys.entry(variantNumber)
    ),
    previousOwnership: getOwnershipRecord(queryClient),
    previousRecentAdds: snapshotRecentActivityQueries(queryClient),
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
  variantNumber: string,
  context?: CollectionMutationContext
) {
  if (!context) return;
  if (context.previousAll !== undefined) {
    queryClient.setQueryData(collectionQueryKeys.all, context.previousAll);
  }
  if (context.previousEntry !== undefined) {
    queryClient.setQueryData(
      collectionQueryKeys.entry(variantNumber),
      context.previousEntry
    );
  }
  if (context.previousOwnership !== undefined) {
    queryClient.setQueryData(
      collectionQueryKeys.ownershipRoot,
      context.previousOwnership
    );
    queryClient.setQueriesData<OwnershipRecord>(
      { queryKey: collectionQueryKeys.ownershipRoot },
      () => context.previousOwnership
    );
  }
  restoreRecentActivityQueries(queryClient, context.previousRecentAdds);
}

function applyCollectionQuantity(
  queryClient: QueryClient,
  variantNumber: string,
  quantity: number,
  seed?: CollectionEntrySeed,
  isFoil = false
) {
  const now = Date.now();
  const all =
    queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
  const index = all.findIndex(
    (entry) => entry.variantNumber === variantNumber && entry.isFoil === isFoil
  );

  if (quantity <= 0) {
    queryClient.setQueryData(
      collectionQueryKeys.all,
      all.filter(
        (entry) => !(entry.variantNumber === variantNumber && entry.isFoil === isFoil)
      )
    );
    queryClient.setQueryData(collectionQueryKeys.entry(variantNumber), null);
    setOwnershipQuantity(queryClient, variantNumber, 0, isFoil);
    return;
  }

  if (index >= 0) {
    const updated: CollectionEntry = {
      ...all[index],
      quantity,
      isFoil,
      updatedAt: now,
    };
    const nextAll = [...all];
    nextAll[index] = updated;
    queryClient.setQueryData(collectionQueryKeys.all, nextAll);
    queryClient.setQueryData(collectionQueryKeys.entry(variantNumber), updated);
    setOwnershipQuantity(queryClient, variantNumber, quantity, isFoil);
    return;
  }

  if (!seed) return;

  const created: CollectionEntry = {
    ...seed,
    variantNumber,
    isFoil,
    quantity,
    addedAt: now,
    updatedAt: now,
  };
  queryClient.setQueryData(collectionQueryKeys.all, [created, ...all]);
  queryClient.setQueryData(collectionQueryKeys.entry(variantNumber), created);
  setOwnershipQuantity(queryClient, variantNumber, quantity, isFoil);
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

function currentQuantity(
  queryClient: QueryClient,
  variantNumber: string,
  isFoil = false
): number {
  const all =
    queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
  const fromAll = all.find(
    (entry) => entry.variantNumber === variantNumber && entry.isFoil === isFoil
  )?.quantity;
  if (fromAll !== undefined) return fromAll;
  const finishKey = collectionFinishKey(variantNumber, isFoil);
  return getOwnershipRecord(queryClient)[finishKey] ?? 0;
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
      const previousQuantity = currentQuantity(queryClient, variantNumber, isFoil);
      const nextQuantity = previousQuantity + 1;
      const seed = entrySeedFromListCard(vars.card, variantNumber, isFoil) ?? undefined;
      applyCollectionQuantity(queryClient, variantNumber, nextQuantity, seed, isFoil);
      recordOptimisticCollectionActivity(queryClient, {
        variantNumber,
        previousQuantity,
        nextQuantity,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, vars, context) => {
      const variantNumber = vars.variantNumber ?? vars.card.variantNumber;
      rollbackCollectionCache(queryClient, variantNumber, context);
    },
    onSettled: (_data, error, vars) => {
      const variantNumber = vars.variantNumber ?? vars.card.variantNumber;
      reconcileCollectionEntries(queryClient, [variantNumber], error);
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
      const previousQuantity = currentQuantity(
        queryClient,
        vars.variantNumber,
        derivedIsFoil
      );
      const nextQuantity = previousQuantity + 1;
      const seed =
        entrySeedFromDetailCard(vars.card, vars.variantNumber, derivedIsFoil) ??
        undefined;
      applyCollectionQuantity(
        queryClient,
        vars.variantNumber,
        nextQuantity,
        seed,
        derivedIsFoil
      );
      recordOptimisticCollectionActivity(queryClient, {
        variantNumber: vars.variantNumber,
        previousQuantity,
        nextQuantity,
        isFoil: derivedIsFoil,
        actor,
      });
      return context;
    },
    onError: (_error, vars, context) => {
      rollbackCollectionCache(queryClient, vars.variantNumber, context);
    },
    onSettled: (_data, error, vars) => {
      reconcileCollectionEntries(queryClient, [vars.variantNumber], error);
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
      const previousQuantity = currentQuantity(queryClient, vars.variantNumber, isFoil);
      applyCollectionQuantity(
        queryClient,
        vars.variantNumber,
        vars.quantity,
        undefined,
        isFoil
      );
      recordOptimisticCollectionActivity(queryClient, {
        variantNumber: vars.variantNumber,
        previousQuantity,
        nextQuantity: vars.quantity,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, vars, context) => {
      rollbackCollectionCache(queryClient, vars.variantNumber, context);
    },
    onSettled: (_data, error, vars) => {
      reconcileCollectionEntries(queryClient, [vars.variantNumber], error);
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
      const previousQuantity = currentQuantity(queryClient, vars.variantNumber, isFoil);
      const nextQuantity = previousQuantity + vars.delta;
      applyCollectionQuantity(
        queryClient,
        vars.variantNumber,
        nextQuantity,
        undefined,
        isFoil
      );
      recordOptimisticCollectionActivity(queryClient, {
        variantNumber: vars.variantNumber,
        previousQuantity,
        nextQuantity,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, vars, context) => {
      rollbackCollectionCache(queryClient, vars.variantNumber, context);
    },
    onSettled: (_data, error, vars) => {
      reconcileCollectionEntries(queryClient, [vars.variantNumber], error);
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
      const previousQuantity = currentQuantity(queryClient, variantNumber, isFoil);
      applyCollectionQuantity(queryClient, variantNumber, 0, undefined, isFoil);
      recordOptimisticCollectionActivity(queryClient, {
        variantNumber,
        previousQuantity,
        nextQuantity: 0,
        isFoil,
        actor,
      });
      return context;
    },
    onError: (_error, input, context) => {
      const variantNumber = typeof input === 'string' ? input : input.variantNumber;
      rollbackCollectionCache(queryClient, variantNumber, context);
    },
    onSettled: (_data, error, input) => {
      const variantNumber = typeof input === 'string' ? input : input.variantNumber;
      reconcileCollectionEntries(queryClient, [variantNumber], error);
    },
  });

  const removeMany = useMutation({
    mutationKey: collectionMutationKey,
    meta: { action: 'collection.remove_many' },
    mutationFn: (variantNumbers: string[]) => removeManyFromCollection(variantNumbers),
    onMutate: (variantNumbers) => {
      bumpCollectionMutationGeneration(queryClient);
      const previousAll = queryClient.getQueryData<CollectionEntry[]>(
        collectionQueryKeys.all
      );
      const previousOwnership = getOwnershipRecord(queryClient);
      const previousRecentAdds = snapshotRecentActivityQueries(queryClient);
      const previousEntries = new Map(
        variantNumbers.map((variantNumber) => [
          variantNumber,
          queryClient.getQueryData<CollectionEntry | null>(
            collectionQueryKeys.entry(variantNumber)
          ),
        ])
      );

      const removeSet = new Set(variantNumbers);
      queryClient.setQueryData(
        collectionQueryKeys.all,
        (previousAll ?? []).filter((entry) => !removeSet.has(entry.variantNumber))
      );
      for (const variantNumber of variantNumbers) {
        queryClient.setQueryData(collectionQueryKeys.entry(variantNumber), null);
        // Clear both finish keys — removeMany deletes every stack for the VN.
        setOwnershipQuantity(queryClient, variantNumber, 0, false);
        setOwnershipQuantity(queryClient, variantNumber, 0, true);
      }

      void queryClient.cancelQueries({
        queryKey: collectionQueryKeys.all,
        exact: true,
      });
      void queryClient.cancelQueries({ queryKey: collectionQueryKeys.ownershipRoot });
      void queryClient.cancelQueries({ queryKey: collectionQueryKeys.recentAddsRoot });
      for (const variantNumber of variantNumbers) {
        void queryClient.cancelQueries({
          queryKey: collectionQueryKeys.entry(variantNumber),
        });
      }

      return { previousAll, previousEntries, previousOwnership, previousRecentAdds };
    },
    onError: (_error, variantNumbers, context) => {
      if (context?.previousAll !== undefined) {
        queryClient.setQueryData(collectionQueryKeys.all, context.previousAll);
      }
      for (const variantNumber of variantNumbers) {
        const previousEntry = context?.previousEntries?.get(variantNumber);
        if (previousEntry !== undefined) {
          queryClient.setQueryData(
            collectionQueryKeys.entry(variantNumber),
            previousEntry
          );
        }
      }
      if (context?.previousOwnership !== undefined) {
        queryClient.setQueryData(
          collectionQueryKeys.ownershipRoot,
          context.previousOwnership
        );
        queryClient.setQueriesData<OwnershipRecord>(
          { queryKey: collectionQueryKeys.ownershipRoot },
          () => context.previousOwnership
        );
      }
      restoreRecentActivityQueries(queryClient, context?.previousRecentAdds);
    },
    onSettled: (_data, error, variantNumbers) => {
      reconcileCollectionEntries(queryClient, variantNumbers, error);
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
