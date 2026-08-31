import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { CollectionShareAcceptMode } from '@riftbound/contracts';
import { collectionSharePollInterval } from '@/hooks/collectionLiveSync';
import {
  acceptCollectionShareInvite,
  createCollectionShareInvite,
  fetchCollectionShareInvitePreview,
  fetchCollectionShareStatus,
  leaveCollectionShare,
  revokeCollectionShareInvite,
} from '@/services/remoteCollectionShareService';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import { authClient } from '@/src/lib/auth-client';

export function prefetchCollectionShareStatus(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: collectionQueryKeys.share,
    queryFn: fetchCollectionShareStatus,
    staleTime: 30_000,
  });
}

export function useCollectionShareStatus(enabled = true) {
  const sessionQuery = authClient.useSession();
  const signedIn = Boolean(sessionQuery.data?.user);

  return useQuery({
    queryKey: collectionQueryKeys.share,
    queryFn: fetchCollectionShareStatus,
    enabled: enabled && signedIn,
    staleTime: 30_000,
    refetchInterval: (query) => collectionSharePollInterval(query.state.data),
  });
}

export function useCollectionShareInvitePreview(token: string | undefined) {
  const sessionQuery = authClient.useSession();
  const signedIn = Boolean(sessionQuery.data?.user);

  return useQuery({
    queryKey: [...collectionQueryKeys.share, 'invite', token ?? ''] as const,
    queryFn: () => fetchCollectionShareInvitePreview(token!),
    enabled: Boolean(token) && signedIn,
  });
}

function invalidateCollectionAndShare(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    queryKey: collectionQueryKeys.all,
    exact: true,
  });
  void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.ownershipRoot });
  void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.recentAddsRoot });
  void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.share });
}

export function useCollectionShareMutations() {
  const queryClient = useQueryClient();

  const createInvite = useMutation({
    mutationFn: createCollectionShareInvite,
    meta: { action: 'collection.share.create_invite' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.share });
    },
  });

  const revokeInvite = useMutation({
    mutationFn: revokeCollectionShareInvite,
    meta: { action: 'collection.share.revoke_invite' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.share });
    },
  });

  const acceptInvite = useMutation({
    mutationFn: (input: { token: string; mode: CollectionShareAcceptMode }) =>
      acceptCollectionShareInvite(input.token, input.mode),
    meta: { action: 'collection.share.accept_invite' },
    onSuccess: () => {
      invalidateCollectionAndShare(queryClient);
    },
  });

  const leave = useMutation({
    mutationFn: leaveCollectionShare,
    meta: { action: 'collection.share.leave' },
    onSuccess: () => {
      invalidateCollectionAndShare(queryClient);
    },
  });

  return { createInvite, revokeInvite, acceptInvite, leave };
}
