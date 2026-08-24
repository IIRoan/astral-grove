import type {
  CollectionShareAcceptMode,
  CollectionShareInvitePreview,
  CollectionShareStatus,
} from '@riftbound/contracts';
import {
  CollectionShareAcceptResponse,
  CollectionShareInviteCreateResponse,
  CollectionShareInvitePreviewResponse,
  CollectionShareLeaveResponse,
  CollectionShareStatusResponse,
} from '@riftbound/contracts';
import { authedFetch, parseOrThrow } from '@/src/api/authedClient';

export async function fetchCollectionShareStatus(): Promise<CollectionShareStatus> {
  const res = await authedFetch<{ data: CollectionShareStatus }>(
    '/api/v1/collection/share'
  );
  return parseOrThrow(
    'collection.share.status.parse',
    CollectionShareStatusResponse,
    res
  ).data;
}

export async function createCollectionShareInvite(): Promise<{
  token: string;
  url: string;
  expiresAt: string;
}> {
  const res = await authedFetch<{ data: unknown }>('/api/v1/collection/share/invite', {
    method: 'POST',
  });
  return parseOrThrow(
    'collection.share.invite.parse',
    CollectionShareInviteCreateResponse,
    res
  ).data;
}

export async function revokeCollectionShareInvite(): Promise<void> {
  await authedFetch('/api/v1/collection/share/invite/revoke', { method: 'POST' });
}

export async function fetchCollectionShareInvitePreview(
  token: string
): Promise<CollectionShareInvitePreview> {
  const res = await authedFetch<{ data: unknown }>(
    `/api/v1/collection/share/invite/${encodeURIComponent(token)}`
  );
  return parseOrThrow(
    'collection.share.preview.parse',
    CollectionShareInvitePreviewResponse,
    res
  ).data;
}

export async function acceptCollectionShareInvite(
  token: string,
  mode: CollectionShareAcceptMode
): Promise<CollectionShareStatus> {
  const res = await authedFetch<{ data: unknown }>(
    `/api/v1/collection/share/invite/${encodeURIComponent(token)}/accept`,
    {
      method: 'POST',
      body: { mode },
    }
  );
  return parseOrThrow(
    'collection.share.accept.parse',
    CollectionShareAcceptResponse,
    res
  ).data;
}

export async function leaveCollectionShare(): Promise<CollectionShareStatus> {
  const res = await authedFetch<{ data: unknown }>('/api/v1/collection/share/leave', {
    method: 'POST',
  });
  return parseOrThrow('collection.share.leave.parse', CollectionShareLeaveResponse, res)
    .data;
}
