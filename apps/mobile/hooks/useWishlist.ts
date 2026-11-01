import { useQuery, type QueryClient } from '@tanstack/react-query';
import { getWishlist, type WishlistEntry } from '@/services/wishlistService';
import {
  persistWishlist,
  readPersistedWishlist,
} from '@/services/wishlistCacheService';
import { wishlistQueryKeys } from '@/src/api/queryKeys';
import { authClient } from '@/src/lib/auth-client';

const WISHLIST_STALE_MS = 60_000;

async function fetchAndPersistWishlist(): Promise<WishlistEntry[]> {
  const entries = await getWishlist();
  await persistWishlist(entries);
  return entries;
}

export async function hydrateWishlistCache(queryClient: QueryClient): Promise<void> {
  const cached = await readPersistedWishlist();
  if (!cached?.length) return;
  if (!queryClient.getQueryData<WishlistEntry[]>(wishlistQueryKeys.all)) {
    queryClient.setQueryData(wishlistQueryKeys.all, cached);
  }
}

export function prefetchWishlist(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: wishlistQueryKeys.all,
    queryFn: fetchAndPersistWishlist,
    staleTime: WISHLIST_STALE_MS,
  });
}

export function useWishlist() {
  const signedIn = Boolean(authClient.useSession().data?.user);
  return useQuery({
    queryKey: wishlistQueryKeys.all,
    queryFn: fetchAndPersistWishlist,
    staleTime: WISHLIST_STALE_MS,
    enabled: signedIn,
  });
}
