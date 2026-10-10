import type { QueryClient } from '@tanstack/react-query';
import { collectionFinishKey } from '@riftbound/contracts';
import type { CollectionEntry } from '@/services/collectionService';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import {
  applyCollectionQuantity,
  getOwnershipRecord,
  type CollectionEntrySeed,
} from '@/lib/collection-optimistic-cache';

type QuantityChange = {
  variantNumber: string;
  isFoil: boolean;
  previousQuantity: number;
  quantity: number;
  relative: boolean;
  seed: CollectionEntrySeed | undefined;
};

export type CollectionOptimisticMutation = {
  changes: QuantityChange[];
  failed: boolean;
  settled: boolean;
};

type MutationBatch = {
  entries: readonly CollectionEntry[];
  ownership: Readonly<Record<string, number>>;
  mutations: CollectionOptimisticMutation[];
};

const batches = new WeakMap<QueryClient, MutationBatch>();

export function collectionCachedQuantity(
  client: QueryClient,
  variantNumber: string,
  isFoil = false
): number {
  const entries = client.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
  return (
    entries.find(
      (entry) => entry.variantNumber === variantNumber && entry.isFoil === isFoil
    )?.quantity ??
    getOwnershipRecord(client)[collectionFinishKey(variantNumber, isFoil)] ??
    0
  );
}

export function beginOptimisticCollectionMutation(
  client: QueryClient
): CollectionOptimisticMutation {
  let batch = batches.get(client);
  if (!batch) {
    batch = {
      entries: client.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [],
      ownership: getOwnershipRecord(client),
      mutations: [],
    };
    batches.set(client, batch);
  }
  const mutation: CollectionOptimisticMutation = {
    changes: [],
    failed: false,
    settled: false,
  };
  batch.mutations.push(mutation);
  return mutation;
}

export function applyOptimisticCollectionQuantity(
  client: QueryClient,
  mutation: CollectionOptimisticMutation,
  variantNumber: string,
  quantity: number,
  seed: CollectionEntrySeed | undefined,
  isFoil: boolean,
  relative = false
): void {
  mutation.changes.push({
    variantNumber,
    isFoil,
    previousQuantity: collectionCachedQuantity(client, variantNumber, isFoil),
    quantity,
    relative,
    seed,
  });
  applyCollectionQuantity(client, variantNumber, quantity, seed, isFoil);
}

/** Replay surviving edits so failure order cannot undo another add, finish or absolute edit. */
export function rollbackOptimisticCollectionMutation(
  client: QueryClient,
  mutation: CollectionOptimisticMutation
): void {
  const batch = batches.get(client);
  if (!batch) return;
  mutation.failed = true;
  const restored = new Set<string>();
  for (const failedChange of mutation.changes) {
    const { variantNumber, isFoil } = failedChange;
    const key = collectionFinishKey(variantNumber, isFoil);
    if (restored.has(key)) continue;
    restored.add(key);
    const original = batch.entries.find(
      (entry) => entry.variantNumber === variantNumber && entry.isFoil === isFoil
    );
    let quantity = original?.quantity ?? batch.ownership[key] ?? 0;
    let seed: CollectionEntrySeed | undefined = original;
    for (const operation of batch.mutations) {
      for (const change of operation.changes) {
        if (change.variantNumber !== variantNumber || change.isFoil !== isFoil)
          continue;
        seed = change.seed ?? seed;
        if (operation.failed) continue;
        quantity = Math.max(
          0,
          change.relative
            ? quantity + change.quantity - change.previousQuantity
            : change.quantity
        );
      }
    }
    applyCollectionQuantity(client, variantNumber, quantity, seed, isFoil);
  }
  for (const variantNumber of new Set(
    mutation.changes.map((change) => change.variantNumber)
  )) {
    const entries =
      client.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
    client.setQueryData(
      collectionQueryKeys.entry(variantNumber),
      entries.find((entry) => entry.variantNumber === variantNumber) ?? null
    );
  }
}

/** Reconcile once all requests finish; an earlier failure must survive a later success. */
export function settleOptimisticCollectionMutation(
  client: QueryClient,
  mutation: CollectionOptimisticMutation
): string[] | null {
  const batch = batches.get(client);
  if (!batch) return null;
  mutation.settled = true;
  if (batch.mutations.some((operation) => !operation.settled)) return null;
  batches.delete(client);
  if (!batch.mutations.some((operation) => operation.failed)) return null;
  return [
    ...new Set(
      batch.mutations.flatMap((operation) =>
        operation.changes.map((change) => change.variantNumber)
      )
    ),
  ];
}
