import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type {
  CollectionShareAcceptMode,
  CollectionShareStatus,
} from '@riftbound/contracts';
import { user as userTable } from '../db/auth-schema.js';
import type { Database } from '../db/client.js';
import {
  collectionAuditEvents,
  collectionInvites,
  collectionItems,
  collectionMembers,
  collections,
} from '../db/schema.js';
import { ensureCollectionMembership } from './collection-membership.js';
import {
  createInviteToken,
  hashInviteToken,
  inviteLookupKeys,
} from '../lib/invite-token.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 2;

export class CollectionShareError extends Error {
  readonly httpStatus: number;

  constructor(
    message: string,
    readonly code:
      'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'CollectionShareError';
    this.httpStatus =
      code === 'NOT_FOUND'
        ? 404
        : code === 'CONFLICT'
          ? 409
          : code === 'FORBIDDEN'
            ? 403
            : 400;
  }
}

export type CollectionStackKey = {
  variantNumber: string;
  condition: string;
  language: string;
  quantity: number;
  isFoil?: boolean;
  notes?: string | null;
  isGraded?: boolean;
  gradeCompany?: string | null;
  gradeScore?: string | null;
  acquiredAt?: Date | null;
  acquiredPriceCents?: number | null;
};

export function mergeCollectionStacks(
  target: CollectionStackKey[],
  source: CollectionStackKey[]
): CollectionStackKey[] {
  const map = new Map<string, CollectionStackKey>();
  const keyOf = (s: CollectionStackKey) =>
    `${s.variantNumber}\0${s.condition}\0${s.language}\0${s.isFoil ? '1' : '0'}`;

  for (const item of target) {
    map.set(keyOf(item), { ...item });
  }
  for (const item of source) {
    const key = keyOf(item);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return [...map.values()];
}

export function buildCollectionInviteDeepLink(token: string): string {
  return `astral-grove://collection/invite/${token}`;
}

/** HTTPS invite URL to Expo web linking page (native deep link on mobile, web accept on desktop). */
export function buildCollectionInviteUrl(token: string, publicAppUrl: string): string {
  const base = publicAppUrl.replace(/\/$/, '');
  return `${base}/invite/${token}`;
}

function toIso(value: Date): string {
  return value.toISOString();
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export class CollectionShareService {
  constructor(
    private readonly db: Database,
    private readonly publicAppUrl: string
  ) {}

  private inviteUrl(token: string): string {
    return buildCollectionInviteUrl(token, this.publicAppUrl);
  }

  async getStatus(userId: string): Promise<CollectionShareStatus> {
    const membership = await ensureCollectionMembership(this.db, userId);
    return this.buildStatus(this.db, userId, membership.collectionId, membership.role);
  }

  async createInvite(userId: string): Promise<{
    token: string;
    url: string;
    expiresAt: string;
  }> {
    const membership = await ensureCollectionMembership(this.db, userId);
    const memberCount = await this.countMembers(this.db, membership.collectionId);
    if (memberCount >= MAX_MEMBERS) {
      throw new CollectionShareError(
        'Collection already has the maximum of 2 members',
        'CONFLICT'
      );
    }

    await this.db
      .update(collectionInvites)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(collectionInvites.collectionId, membership.collectionId),
          eq(collectionInvites.status, 'pending')
        )
      );

    const token = createInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await this.db.insert(collectionInvites).values({
      token: hashInviteToken(token),
      collectionId: membership.collectionId,
      inviterUserId: userId,
      status: 'pending',
      expiresAt,
    });

    return { token, url: this.inviteUrl(token), expiresAt: toIso(expiresAt) };
  }

  async revokeInvite(userId: string): Promise<void> {
    const membership = await ensureCollectionMembership(this.db, userId);
    await this.db
      .update(collectionInvites)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(collectionInvites.collectionId, membership.collectionId),
          eq(collectionInvites.status, 'pending')
        )
      );
  }

  async previewInvite(userId: string, token: string) {
    const invite = await this.loadPendingInvite(token);
    await ensureCollectionMembership(this.db, invite.inviterUserId);
    const joinerMembership = await ensureCollectionMembership(this.db, userId);

    const [inviter] = await this.db
      .select({
        userId: userTable.id,
        name: userTable.name,
      })
      .from(userTable)
      .where(eq(userTable.id, invite.inviterUserId))
      .limit(1);

    if (!inviter) {
      throw new CollectionShareError('Inviter not found', 'NOT_FOUND');
    }

    const theirStats = await this.collectionStats(invite.collectionId);
    const yourStats = await this.collectionStats(joinerMembership.collectionId);

    let canAccept = true;
    let reason: string | null = null;

    if (userId === invite.inviterUserId) {
      canAccept = false;
      reason = 'You cannot accept your own invite';
    } else if (joinerMembership.collectionId === invite.collectionId) {
      canAccept = false;
      reason = 'You are already a member of this collection';
    } else {
      const theirMembers = await this.countMembers(this.db, invite.collectionId);
      const yourMembers = await this.countMembers(
        this.db,
        joinerMembership.collectionId
      );
      if (theirMembers >= MAX_MEMBERS) {
        canAccept = false;
        reason = 'This collection already has 2 members';
      } else if (yourMembers >= MAX_MEMBERS) {
        canAccept = false;
        reason = 'Leave your current shared collection before joining another';
      }
    }

    return {
      token,
      expiresAt: toIso(invite.expiresAt),
      inviter: {
        userId: inviter.userId,
        name: inviter.name,
      },
      theirItemCount: theirStats.itemCount,
      theirTotalQuantity: theirStats.totalQuantity,
      yourItemCount: yourStats.itemCount,
      yourTotalQuantity: yourStats.totalQuantity,
      canAccept,
      reason,
    };
  }

  async acceptInvite(
    userId: string,
    token: string,
    mode: CollectionShareAcceptMode
  ): Promise<CollectionShareStatus> {
    // Ensure memberships exist before entering the transaction (avoids nested tx).
    await ensureCollectionMembership(this.db, userId);

    return this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(collectionInvites)
        .where(inArray(collectionInvites.token, inviteLookupKeys(token)))
        .limit(1);

      if (!invite || invite.status !== 'pending') {
        throw new CollectionShareError(
          'Invite not found or no longer valid',
          'NOT_FOUND'
        );
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        await tx
          .update(collectionInvites)
          .set({ status: 'expired' })
          .where(eq(collectionInvites.id, invite.id));
        throw new CollectionShareError('Invite has expired', 'BAD_REQUEST');
      }
      if (userId === invite.inviterUserId) {
        throw new CollectionShareError(
          'You cannot accept your own invite',
          'BAD_REQUEST'
        );
      }

      const [joinerMembership] = await tx
        .select({
          collectionId: collectionMembers.collectionId,
          role: collectionMembers.role,
        })
        .from(collectionMembers)
        .where(eq(collectionMembers.userId, userId))
        .limit(1);

      if (!joinerMembership) {
        throw new CollectionShareError('Collection membership not found', 'NOT_FOUND');
      }

      if (joinerMembership.collectionId === invite.collectionId) {
        throw new CollectionShareError(
          'You are already a member of this collection',
          'CONFLICT'
        );
      }

      const theirCount = await this.countMembers(tx, invite.collectionId);
      const yourCount = await this.countMembers(tx, joinerMembership.collectionId);
      if (theirCount >= MAX_MEMBERS) {
        throw new CollectionShareError(
          'This collection already has 2 members',
          'CONFLICT'
        );
      }
      if (yourCount >= MAX_MEMBERS) {
        throw new CollectionShareError(
          'Leave your current shared collection before joining another',
          'CONFLICT'
        );
      }

      const joinerCollectionId = joinerMembership.collectionId;

      const joinerItems = await tx
        .select()
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, joinerCollectionId));

      if (mode === 'use_theirs') {
        if (joinerItems.length > 0) {
          await tx.insert(collectionAuditEvents).values(
            joinerItems.map((item) => ({
              collectionId: joinerCollectionId,
              actorUserId: userId,
              action: 'share_discard',
              variantNumber: item.variantNumber,
              condition: item.condition,
              language: item.language,
              isFoil: item.isFoil,
              quantityBefore: item.quantity,
              quantityAfter: 0,
              quantityDelta: -item.quantity,
              metadata: {
                mode,
                targetCollectionId: invite.collectionId,
              },
            }))
          );
        }
        await tx
          .delete(collectionItems)
          .where(eq(collectionItems.collectionId, joinerCollectionId));
      } else {
        for (const item of joinerItems) {
          const [existing] = await tx
            .select({ quantity: collectionItems.quantity })
            .from(collectionItems)
            .where(
              and(
                eq(collectionItems.collectionId, invite.collectionId),
                eq(collectionItems.variantNumber, item.variantNumber),
                eq(collectionItems.condition, item.condition),
                eq(collectionItems.language, item.language),
                eq(collectionItems.isFoil, item.isFoil)
              )
            )
            .limit(1);

          const quantityBefore = existing?.quantity ?? 0;

          await tx
            .insert(collectionItems)
            .values({
              collectionId: invite.collectionId,
              variantNumber: item.variantNumber,
              quantity: item.quantity,
              condition: item.condition,
              language: item.language,
              isFoil: item.isFoil,
              notes: item.notes,
              isGraded: item.isGraded,
              gradeCompany: item.gradeCompany,
              gradeScore: item.gradeScore,
              acquiredAt: item.acquiredAt,
              acquiredPriceCents: item.acquiredPriceCents,
            })
            .onConflictDoUpdate({
              target: [
                collectionItems.collectionId,
                collectionItems.variantNumber,
                collectionItems.condition,
                collectionItems.language,
                collectionItems.isFoil,
              ],
              set: {
                quantity: sql`${collectionItems.quantity} + ${item.quantity}`,
                updatedAt: new Date(),
              },
            });

          await tx.insert(collectionAuditEvents).values({
            collectionId: invite.collectionId,
            actorUserId: userId,
            action: 'share_merge',
            variantNumber: item.variantNumber,
            condition: item.condition,
            language: item.language,
            isFoil: item.isFoil,
            quantityBefore,
            quantityAfter: quantityBefore + item.quantity,
            quantityDelta: item.quantity,
            metadata: {
              mode,
              sourceCollectionId: joinerCollectionId,
            },
          });
        }

        await tx
          .delete(collectionItems)
          .where(eq(collectionItems.collectionId, joinerCollectionId));
      }

      await tx
        .update(collectionMembers)
        .set({
          collectionId: invite.collectionId,
          role: 'member',
          joinedAt: new Date(),
        })
        .where(eq(collectionMembers.userId, userId));

      await tx.delete(collections).where(eq(collections.id, joinerCollectionId));

      await tx
        .update(collectionInvites)
        .set({ status: 'accepted' })
        .where(eq(collectionInvites.id, invite.id));

      await tx
        .update(collectionInvites)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(collectionInvites.collectionId, invite.collectionId),
            eq(collectionInvites.status, 'pending')
          )
        );

      await tx
        .update(collections)
        .set({ updatedAt: new Date() })
        .where(eq(collections.id, invite.collectionId));

      return this.buildStatus(tx, userId, invite.collectionId, 'member');
    });
  }

  async leave(userId: string): Promise<CollectionShareStatus> {
    await ensureCollectionMembership(this.db, userId);

    return this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({
          collectionId: collectionMembers.collectionId,
          role: collectionMembers.role,
        })
        .from(collectionMembers)
        .where(eq(collectionMembers.userId, userId))
        .limit(1);

      if (!membership) {
        throw new CollectionShareError('Collection membership not found', 'NOT_FOUND');
      }

      const memberCount = await this.countMembers(tx, membership.collectionId);
      if (memberCount < 2) {
        throw new CollectionShareError(
          'You are not in a shared collection',
          'BAD_REQUEST'
        );
      }

      const [created] = await tx
        .insert(collections)
        .values({})
        .returning({ id: collections.id });
      if (!created) {
        throw new Error('Failed to create personal collection');
      }

      await tx.insert(collectionAuditEvents).values({
        collectionId: created.id,
        actorUserId: userId,
        action: 'share_leave',
        metadata: {
          previousCollectionId: membership.collectionId,
        },
      });

      await tx
        .update(collectionMembers)
        .set({
          collectionId: created.id,
          role: 'owner',
          joinedAt: new Date(),
        })
        .where(eq(collectionMembers.userId, userId));

      await tx
        .update(collectionInvites)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(collectionInvites.collectionId, membership.collectionId),
            eq(collectionInvites.status, 'pending'),
            eq(collectionInvites.inviterUserId, userId)
          )
        );

      return this.buildStatus(tx, userId, created.id, 'owner');
    });
  }

  private async loadPendingInvite(token: string) {
    const [invite] = await this.db
      .select()
      .from(collectionInvites)
      .where(inArray(collectionInvites.token, inviteLookupKeys(token)))
      .limit(1);

    if (!invite) {
      throw new CollectionShareError('Invite not found', 'NOT_FOUND');
    }
    if (invite.status !== 'pending') {
      throw new CollectionShareError('Invite is no longer valid', 'BAD_REQUEST');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.db
        .update(collectionInvites)
        .set({ status: 'expired' })
        .where(eq(collectionInvites.id, invite.id));
      throw new CollectionShareError('Invite has expired', 'BAD_REQUEST');
    }
    return invite;
  }

  private async countMembers(db: Database | Tx, collectionId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(collectionMembers)
      .where(eq(collectionMembers.collectionId, collectionId));
    return Number(row?.value ?? 0);
  }

  private async collectionStats(collectionId: string): Promise<{
    itemCount: number;
    totalQuantity: number;
  }> {
    const [row] = await this.db
      .select({
        itemCount: count(),
        totalQuantity: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)`,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
    return {
      itemCount: Number(row?.itemCount ?? 0),
      totalQuantity: Number(row?.totalQuantity ?? 0),
    };
  }

  private async buildStatus(
    db: Database | Tx,
    userId: string,
    collectionId: string,
    role: string
  ): Promise<CollectionShareStatus> {
    const members = await db
      .select({
        userId: collectionMembers.userId,
        name: userTable.name,
        email: userTable.email,
      })
      .from(collectionMembers)
      .innerJoin(userTable, eq(collectionMembers.userId, userTable.id))
      .where(eq(collectionMembers.collectionId, collectionId));

    const partnerRow = members.find((m) => m.userId !== userId) ?? null;
    const memberCount = members.length;
    const shared = memberCount >= 2;

    let pendingInvite: CollectionShareStatus['pendingInvite'] = null;
    if (!shared) {
      const [invite] = await db
        .select()
        .from(collectionInvites)
        .where(
          and(
            eq(collectionInvites.collectionId, collectionId),
            eq(collectionInvites.status, 'pending')
          )
        )
        .limit(1);
      if (invite && invite.expiresAt.getTime() >= Date.now()) {
        pendingInvite = {
          expiresAt: toIso(invite.expiresAt),
        };
      }
    }

    return {
      shared,
      memberCount,
      collectionId,
      role: role === 'member' ? 'member' : 'owner',
      partner: partnerRow
        ? {
            userId: partnerRow.userId,
            name: partnerRow.name,
            email: partnerRow.email,
          }
        : null,
      pendingInvite,
    };
  }
}
