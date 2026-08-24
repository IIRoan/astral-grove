import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { findVariantByNumber } from '@/utils/variants';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { api } from '@/src/api/client';

export const DECK_IMAGE_STORE_KEY = ['deck-card-image-store'] as const;

const EMPTY_IMAGE_MAP = new Map<string, string>();
const IMAGE_STALE_MS = 24 * 60 * 60 * 1000;

function mergeBatchIntoMap(
  map: Map<string, string>,
  cards: Awaited<ReturnType<typeof api.batchCards>>['data']
): void {
  for (const card of cards) {
    for (const variant of card.variants) {
      if (variant.imageUrl) {
        map.set(variant.variantNumber, resolveImageUrl(variant.imageUrl));
      }
    }
    const primary = findVariantByNumber(
      card.variants,
      card.variants[0]?.variantNumber ?? ''
    );
    if (primary?.imageUrl) {
      map.set(primary.variantNumber, resolveImageUrl(primary.imageUrl));
    }
  }
}

/** Incremental image cache — only fetches variants not already stored. */
export function useDeckCardImages(variantKey: string) {
  const queryClient = useQueryClient();
  const needed = useMemo(
    () => [...new Set(variantKey.split('|').filter(Boolean))],
    [variantKey]
  );

  const { data: store = EMPTY_IMAGE_MAP } = useQuery({
    queryKey: DECK_IMAGE_STORE_KEY,
    queryFn: () => new Map(EMPTY_IMAGE_MAP),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: IMAGE_STALE_MS,
    initialData: () => EMPTY_IMAGE_MAP,
  });

  const missingKey = useMemo(
    () =>
      needed
        .filter((variantNumber) => !store.has(variantNumber))
        .sort()
        .join('|'),
    [needed, store]
  );

  useQuery({
    queryKey: ['deck-card-images-fetch', missingKey],
    queryFn: async () => {
      const missing = missingKey.split('|').filter(Boolean);
      if (!missing.length) return false;

      const response = await api.batchCards(missing.slice(0, 100));
      queryClient.setQueryData<Map<string, string>>(DECK_IMAGE_STORE_KEY, (prev) => {
        const next = new Map(prev ?? EMPTY_IMAGE_MAP);
        mergeBatchIntoMap(next, response.data);
        return next;
      });
      return true;
    },
    enabled: missingKey.length > 0,
    staleTime: IMAGE_STALE_MS,
    gcTime: IMAGE_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const imageByVariant = useMemo(() => {
    if (!needed.length) return EMPTY_IMAGE_MAP;

    let subset = EMPTY_IMAGE_MAP;
    for (const variantNumber of needed) {
      const url = store.get(variantNumber);
      if (!url) continue;
      if (subset === EMPTY_IMAGE_MAP) {
        subset = new Map<string, string>();
      }
      subset.set(variantNumber, url);
    }
    return subset;
  }, [needed, store]);

  return { data: imageByVariant };
}
