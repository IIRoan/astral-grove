import { z } from 'zod';
import { dataResponse, IsoDateTimeString } from './common.js';

export const CollectionShareAcceptMode = z.enum(['use_theirs', 'merge']);
export type CollectionShareAcceptMode = z.infer<typeof CollectionShareAcceptMode>;

export const CollectionSharePerson = z.object({
  userId: z.string(),
  name: z.string(),
});

export type CollectionSharePerson = z.infer<typeof CollectionSharePerson>;

export const CollectionSharePartner = CollectionSharePerson.extend({
  email: z.string().email(),
});

export type CollectionSharePartner = z.infer<typeof CollectionSharePartner>;

export const CollectionSharePendingInvite = z.object({
  expiresAt: IsoDateTimeString,
  token: z.string().optional(),
  url: z.string().optional(),
});

export type CollectionSharePendingInvite = z.infer<typeof CollectionSharePendingInvite>;

export const CollectionShareStatus = z.object({
  shared: z.boolean(),
  memberCount: z.number().int().positive(),
  collectionId: z.string().uuid(),
  role: z.enum(['owner', 'member']),
  partner: CollectionSharePartner.nullable(),
  pendingInvite: CollectionSharePendingInvite.nullable(),
});

export type CollectionShareStatus = z.infer<typeof CollectionShareStatus>;

export const CollectionShareStatusResponse = dataResponse(CollectionShareStatus);

export type CollectionShareStatusResponse = z.infer<typeof CollectionShareStatusResponse>;

export const CollectionShareInviteCreate = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: IsoDateTimeString,
});

export type CollectionShareInviteCreate = z.infer<typeof CollectionShareInviteCreate>;

export const CollectionShareInviteCreateResponse = dataResponse(CollectionShareInviteCreate);

export type CollectionShareInviteCreateResponse = z.infer<
  typeof CollectionShareInviteCreateResponse
>;

export const CollectionShareInvitePreview = z.object({
  token: z.string(),
  expiresAt: IsoDateTimeString,
  inviter: CollectionSharePerson,
  theirItemCount: z.number().int().nonnegative(),
  theirTotalQuantity: z.number().int().nonnegative(),
  yourItemCount: z.number().int().nonnegative(),
  yourTotalQuantity: z.number().int().nonnegative(),
  canAccept: z.boolean(),
  reason: z.string().nullable(),
});

export type CollectionShareInvitePreview = z.infer<typeof CollectionShareInvitePreview>;

export const CollectionShareInvitePreviewResponse = dataResponse(
  CollectionShareInvitePreview
);

export type CollectionShareInvitePreviewResponse = z.infer<
  typeof CollectionShareInvitePreviewResponse
>;

export const CollectionShareAcceptRequest = z.object({
  mode: CollectionShareAcceptMode,
});

export type CollectionShareAcceptRequest = z.infer<typeof CollectionShareAcceptRequest>;

export const CollectionShareAcceptResponse = dataResponse(CollectionShareStatus);

export type CollectionShareAcceptResponse = z.infer<typeof CollectionShareAcceptResponse>;

export const CollectionShareLeaveResponse = dataResponse(CollectionShareStatus);

export type CollectionShareLeaveResponse = z.infer<typeof CollectionShareLeaveResponse>;
