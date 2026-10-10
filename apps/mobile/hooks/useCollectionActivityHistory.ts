import { useInfiniteQuery } from '@tanstack/react-query';
import type { CollectionActivityCursor } from '@riftbound/contracts';
import { useMemo } from 'react';
import { fetchRemoteCollectionActivityHistory } from '@/services/remoteCollectionService';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import { authClient } from '@/src/lib/auth-client';

export function useCollectionActivityHistory(
  variantNumbers: readonly string[],
  enabled: boolean
) {
  const sessionQuery = authClient.useSession();
  const unique = useMemo(
    () => [...new Set(variantNumbers.filter(Boolean))].sort(),
    [variantNumbers]
  );

  return useInfiniteQuery({
    queryKey: collectionQueryKeys.activityHistory(unique),
    initialPageParam: null as CollectionActivityCursor | null,
    queryFn: ({ pageParam }) =>
      fetchRemoteCollectionActivityHistory({
        variantNumbers: unique,
        limit: 20,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.meta.nextCursor ?? undefined,
    enabled: enabled && Boolean(sessionQuery.data?.user) && unique.length > 0,
    staleTime: 30_000,
  });
}
