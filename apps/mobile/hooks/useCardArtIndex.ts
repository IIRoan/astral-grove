import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogQueryKeys } from '@/src/api/queryKeys';
import { fetchCatalogMeta } from '@/services/catalogMetaService';
import {
  ensureCardArtIndex,
  getCardArtIndexState,
  subscribeCardArtIndex,
} from '@/services/cardArtIndex';

const META_STALE_MS = 5 * 60_000;

/**
 * Keeps the scanner's artwork index in step with the catalog while the scanner is open.
 * Fetched on first use rather than at launch: nothing outside the scanner reads it, and
 * the catalog hash tells us when the copy on disk has gone stale.
 */
export function useCardArtIndex() {
  const meta = useQuery({
    queryKey: catalogQueryKeys.meta,
    queryFn: fetchCatalogMeta,
    staleTime: META_STALE_MS,
  });
  const hash = meta.data?.artIndexHash;

  useEffect(() => {
    void ensureCardArtIndex(hash);
  }, [hash]);

  return useSyncExternalStore(subscribeCardArtIndex, getCardArtIndexState);
}
