import type { QueryClient } from '@tanstack/react-query';
import { clearPersistedCatalogIndex } from '@/services/catalogIndexService';
import { clearPersistedCollection } from '@/services/collectionCacheService';
import { clearPersistedOwnedDecks } from '@/services/deckCacheService';
import { clearLastCachedUserId } from '@/services/userCacheScope';
import { clearPersistedWishlist } from '@/services/wishlistCacheService';
import { removeUserDataQueries } from '@/src/api/queryClient';
import { clearPersistedQueryClient } from '@/src/api/queryPersist';

/** Wipe disk and in-memory account data after sign-out or account deletion. */
export async function clearLocalAccountData(queryClient: QueryClient): Promise<void> {
  await clearPersistedCollection();
  await clearPersistedOwnedDecks();
  await clearPersistedWishlist();
  await clearPersistedCatalogIndex();
  await clearPersistedQueryClient();
  await clearLastCachedUserId();
  removeUserDataQueries(queryClient);
}
