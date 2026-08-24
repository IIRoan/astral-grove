import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CardListItem } from '@riftbound/contracts';
import { catalogQueryKeys } from '@/src/api/queryKeys';
import {
  getInMemoryCatalogIndex,
  readPersistedCatalogIndex,
  syncCatalogIndex,
} from '@/services/catalogIndexService';
import {
  prefetchCatalogMeta,
  resolveCatalogIndexCacheKey,
} from '@/services/catalogMetaService';

export function useCatalogIndex() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: catalogQueryKeys.index,
    queryFn: () => syncCatalogIndex(() => resolveCatalogIndexCacheKey(queryClient)),
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: () => {
      const inMemory = getInMemoryCatalogIndex();
      if (inMemory) return inMemory;
      return queryClient.getQueryData(catalogQueryKeys.index);
    },
    initialData: () => getInMemoryCatalogIndex() ?? undefined,
  });
}

export async function hydrateCatalogIndex(
  queryClient: ReturnType<typeof useQueryClient>
) {
  const persisted = await readPersistedCatalogIndex();
  if (persisted) {
    queryClient.setQueryData(catalogQueryKeys.index, persisted);
  }
}

export async function prefetchCatalogIndex(
  queryClient: ReturnType<typeof useQueryClient>
) {
  await hydrateCatalogIndex(queryClient);
  void prefetchCatalogMeta(queryClient);
  void queryClient.prefetchQuery({
    queryKey: catalogQueryKeys.index,
    queryFn: () => syncCatalogIndex(() => resolveCatalogIndexCacheKey(queryClient)),
    staleTime: 10 * 60 * 1000,
  });
}

export function getCatalogIndexItems(
  index: { items: CardListItem[] } | null | undefined
): CardListItem[] {
  return index?.items ?? getInMemoryCatalogIndex()?.items ?? [];
}
