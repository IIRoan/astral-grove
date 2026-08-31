import { AppState, Platform } from 'react-native';
import { MutationCache, QueryClient, focusManager } from '@tanstack/react-query';
import { logActionFailure } from '@/lib/logger';
import {
  cardQueryKeys,
  catalogQueryKeys,
  collectionQueryKeys,
  deckQueryKeys,
  wishlistQueryKeys,
} from '@/src/api/queryKeys';

/** Map iOS/Android app resume to TanStack Query's window-focus refetch. */
export function setupQueryFocusManager(): void {
  if (Platform.OS === 'web') return;

  focusManager.setEventListener((onFocus) => {
    const subscription = AppState.addEventListener('change', (status) => {
      onFocus(status === 'active');
    });
    return () => subscription.remove();
  });
}

export function mutationLogAction(
  mutationKey: readonly unknown[] | undefined,
  meta: unknown
): string {
  if (meta && typeof meta === 'object' && 'action' in meta) {
    const action = meta.action;
    if (typeof action === 'string' && action.length > 0) return action;
  }
  if (Array.isArray(mutationKey) && mutationKey.length > 0) {
    return mutationKey.map(String).join('.');
  }
  return 'mutation';
}

export function mutationLogContext(
  variables: unknown
): Record<string, unknown> | undefined {
  if (typeof variables === 'string') return { id: variables };
  if (Array.isArray(variables)) return { count: variables.length };
  if (variables == null || typeof variables !== 'object') return undefined;

  const value = variables as Record<string, unknown>;
  const context: Record<string, unknown> = {};
  if (typeof value.variantNumber === 'string') {
    context.variantNumber = value.variantNumber;
  }
  if (typeof value.delta === 'number') context.delta = value.delta;
  if (typeof value.quantity === 'number') context.quantity = value.quantity;
  if (typeof value.token === 'string') context.token = value.token;
  if (typeof value.mode === 'string') context.mode = value.mode;
  if (typeof value.sourceDeckId === 'string') context.sourceDeckId = value.sourceDeckId;
  if (typeof value.id === 'string') context.id = value.id;
  const card = value.card;
  if (
    card &&
    typeof card === 'object' &&
    'name' in card &&
    typeof card.name === 'string'
  ) {
    context.cardName = card.name;
  }
  return Object.keys(context).length > 0 ? context : undefined;
}

export function createQueryClient(): QueryClient {
  setupQueryFocusManager();

  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, variables, _context, mutation) => {
        logActionFailure(
          mutationLogAction(mutation.options.mutationKey, mutation.options.meta),
          error,
          mutationLogContext(variables)
        );
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Must exceed QUERY_PERSIST_MAX_AGE_MS so restored queries are not GC'd.
        gcTime: 24 * 60 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}

/** Refresh account-bound lists after sign-in or background sync. */
export async function invalidateUserDataQueries(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all, exact: true }),
    queryClient.invalidateQueries({ queryKey: collectionQueryKeys.ownershipRoot }),
    queryClient.invalidateQueries({ queryKey: collectionQueryKeys.recentAddsRoot }),
    queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.prices }),
    queryClient.invalidateQueries({ queryKey: deckQueryKeys.all }),
  ]);
}

/** Drop cached account data on sign-out so the next user never sees stale rows. */
export function removeUserDataQueries(queryClient: QueryClient): void {
  for (const key of [
    collectionQueryKeys.all,
    collectionQueryKeys.ownershipRoot,
    collectionQueryKeys.recentAddsRoot,
    wishlistQueryKeys.all,
    wishlistQueryKeys.prices,
    deckQueryKeys.all,
  ]) {
    queryClient.removeQueries({ queryKey: key });
  }
}

/** Catalog index/meta can go stale after a server sync — nudge without wiping disk cache. */
export async function invalidateCatalogQueries(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: catalogQueryKeys.index }),
    queryClient.invalidateQueries({ queryKey: catalogQueryKeys.meta }),
    queryClient.invalidateQueries({ queryKey: catalogQueryKeys.filters }),
    queryClient.invalidateQueries({ queryKey: cardQueryKeys.browse() }),
  ]);
}
