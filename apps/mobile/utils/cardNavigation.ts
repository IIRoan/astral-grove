import type { ImperativeRouter } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';
import { ensureCardDetail } from '@/lib/prefetchCardDetail';

export type CardPresentMode = 'modal' | 'page';
export type CardOpenSource = 'catalog' | 'collection' | 'wishlist' | 'deck-view';

export function openCard(
  router: ImperativeRouter,
  variantNumber: string,
  present: CardPresentMode = 'modal',
  source?: CardOpenSource,
  queryClient?: QueryClient,
  /** `replace` swaps the current screen out — used by the scanner so it does not linger. */
  navigate: 'push' | 'replace' = 'push'
) {
  // Start rules-text fetch during the navigation animation.
  if (queryClient) {
    ensureCardDetail(queryClient, variantNumber);
  }
  const params = new URLSearchParams({ present });
  if (source) params.set('source', source);
  // Inline rather than hoisted to a const — typed routes need the template literal type.
  if (navigate === 'replace') {
    router.replace(`/card/${encodeURIComponent(variantNumber)}?${params.toString()}`);
    return;
  }
  router.push(`/card/${encodeURIComponent(variantNumber)}?${params.toString()}`);
}

export function parseCardOpenSource(
  value: string | string[] | undefined
): CardOpenSource {
  const source = Array.isArray(value) ? value[0] : value;
  if (source === 'wishlist' || source === 'collection' || source === 'deck-view') {
    return source;
  }
  return 'catalog';
}

export function closeCard(router: ImperativeRouter) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)/search');
}
