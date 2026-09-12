import type { QueryClient } from '@tanstack/react-query';
import { collectionFinishKey } from '@riftbound/contracts';
import type { CollectionEntry } from '@/services/collectionService';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import { mergeOwnershipRecords } from '@/utils/collectionOwnership';

type OwnershipRecord = Record<string, number>;

export type CollectionEntrySeed = Omit<
  CollectionEntry,
  'quantity' | 'addedAt' | 'updatedAt' | 'variantNumber'
>;

export function getOwnershipRecord(queryClient: QueryClient): OwnershipRecord {
  return (
    queryClient.getQueryData<OwnershipRecord>(collectionQueryKeys.ownershipRoot) ?? {}
  );
}

export function setOwnershipQuantity(
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

export function applyCollectionQuantity(
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

  setOwnershipQuantity(queryClient, variantNumber, quantity, isFoil);

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
}
