import type { QueryClient } from '@tanstack/react-query';
import { catalogQueryKeys } from '@/src/api/queryKeys';
import { api } from '@/src/api/client';
import type { CatalogIndexCacheKey } from '@/services/catalogIndexService';
import {
  getInMemoryCatalogIndex,
  readPersistedCatalogIndex,
} from '@/services/catalogIndexService';

type CatalogMeta = {
  cachedAt: string;
  catalogHash: string;
  pricesCatalogHash: string;
  variantCount: number;
};

const CATALOG_META_STALE_MS = 5 * 60_000;

function getCachedCatalogMeta(
  queryClient: Pick<QueryClient, 'getQueryData'>
): CatalogMeta | undefined {
  return queryClient.getQueryData<CatalogMeta>(catalogQueryKeys.meta);
}

async function fetchCatalogMeta(): Promise<CatalogMeta> {
  const res = await api.getFilters();
  return res.meta;
}

export function prefetchCatalogMeta(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: catalogQueryKeys.meta,
    queryFn: fetchCatalogMeta,
    staleTime: CATALOG_META_STALE_MS,
  });
}

export async function resolveCatalogIndexCacheKey(
  queryClient?: Pick<QueryClient, 'getQueryData' | 'setQueryData'>
): Promise<CatalogIndexCacheKey> {
  const cached = queryClient ? getCachedCatalogMeta(queryClient) : undefined;
  if (cached) {
    return {
      catalogHash: cached.catalogHash,
      pricesCatalogHash: cached.pricesCatalogHash,
      variantCount: cached.variantCount,
    };
  }

  try {
    const meta = await fetchCatalogMeta();
    queryClient?.setQueryData(catalogQueryKeys.meta, meta);
    return {
      catalogHash: meta.catalogHash,
      pricesCatalogHash: meta.pricesCatalogHash,
      variantCount: meta.variantCount,
    };
  } catch {
    const inMemory = getInMemoryCatalogIndex();
    if (inMemory) {
      return {
        catalogHash: inMemory.catalogHash,
        pricesCatalogHash: inMemory.pricesCatalogHash,
        variantCount: inMemory.items.length,
      };
    }

    const persisted = await readPersistedCatalogIndex();
    return {
      catalogHash: persisted?.catalogHash ?? '',
      pricesCatalogHash: persisted?.pricesCatalogHash ?? '',
      variantCount: persisted?.items.length,
    };
  }
}
