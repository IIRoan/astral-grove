import type { QueryClient } from '@tanstack/react-query';
import { collectionMutationKey } from '@/src/api/queryKeys';

/** Bumped on mutation start so in-flight list/quantities responses cannot clobber optimistic cache. */
const collectionMutationGeneration = new WeakMap<QueryClient, number>();

export function bumpCollectionMutationGeneration(queryClient: QueryClient): number {
  const next = (collectionMutationGeneration.get(queryClient) ?? 0) + 1;
  collectionMutationGeneration.set(queryClient, next);
  return next;
}

export function getCollectionMutationGeneration(queryClient: QueryClient): number {
  return collectionMutationGeneration.get(queryClient) ?? 0;
}

/** Native abort often retries as a network error after generation already bumped. */
export function collectionSnapshotIsStale(
  queryClient: QueryClient,
  fetchGeneration: number,
  startedDuringMutation: boolean
): boolean {
  if (startedDuringMutation) return true;
  if (getCollectionMutationGeneration(queryClient) !== fetchGeneration) return true;
  return queryClient.isMutating({ mutationKey: collectionMutationKey }) > 0;
}
