import { z } from 'zod';
import { CardCondition, CollectionVariantNumbersRequest } from './collection.js';

export const CollectionAuditAction = z.enum([
  'add',
  'remove',
  'upsert',
  'delete',
  'clear',
  'batch',
  'import',
  'share_merge',
  'share_discard',
  'share_leave',
]);

export type CollectionAuditAction = z.infer<typeof CollectionAuditAction>;

export const CollectionAuditActor = z.object({
  userId: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
});

export type CollectionAuditActor = z.infer<typeof CollectionAuditActor>;

export const CollectionAuditEvent = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid().nullable(),
  action: CollectionAuditAction,
  variantNumber: z.string().nullable(),
  condition: CardCondition.nullable(),
  language: z.string().nullable(),
  isFoil: z.boolean().nullable(),
  quantityBefore: z.number().int().nullable(),
  quantityAfter: z.number().int().nullable(),
  quantityDelta: z.number().int().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  actor: CollectionAuditActor,
});

export type CollectionAuditEvent = z.infer<typeof CollectionAuditEvent>;

export const CollectionAuditListQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  /** Return events strictly older than this ISO timestamp. */
  before: z.string().datetime().optional(),
  variantNumber: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
  mine: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1';
    }),
  action: CollectionAuditAction.optional(),
});

export type CollectionAuditListQuery = z.infer<typeof CollectionAuditListQuery>;

export const CollectionAuditListResponse = z.object({
  data: z.array(CollectionAuditEvent),
  meta: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    hasMore: z.boolean(),
  }),
});

export type CollectionAuditListResponse = z.infer<typeof CollectionAuditListResponse>;

export const RECENT_COLLECTION_ACTIVITY_LIMIT = 3;

export const CollectionActivityEvent = z.object({
  id: z.string().uuid(),
  at: z.string().datetime(),
  action: CollectionAuditAction,
  quantityDelta: z.number().int(),
  quantityAfter: z.number().int().nullable(),
  isFoil: z.boolean().nullable(),
  actor: CollectionAuditActor,
});

export type CollectionActivityEvent = z.infer<typeof CollectionActivityEvent>;

export const CollectionRecentAddsRequest = CollectionVariantNumbersRequest;
export type CollectionRecentAddsRequest = CollectionVariantNumbersRequest;

export const CollectionRecentAddsResponse = z.object({
  data: z.array(CollectionActivityEvent).max(10),
});

export type CollectionRecentAddsResponse = z.infer<typeof CollectionRecentAddsResponse>;

type ActivitySource = {
  id: string;
  action: string;
  quantityDelta: number | null;
  quantityAfter: number | null;
  isFoil: boolean | null;
  createdAt: string;
  actor: CollectionAuditActor;
};

export function takeRecentCollectionActivity(
  events: readonly ActivitySource[],
  limit = RECENT_COLLECTION_ACTIVITY_LIMIT
): CollectionActivityEvent[] {
  const out: CollectionActivityEvent[] = [];

  for (const event of events) {
    if (event.quantityDelta == null || event.quantityDelta === 0) continue;
    const action = CollectionAuditAction.safeParse(event.action);
    if (!action.success) continue;
    out.push({
      id: event.id,
      at: event.createdAt,
      action: action.data,
      quantityDelta: event.quantityDelta,
      quantityAfter: event.quantityAfter,
      isFoil: event.isFoil,
      actor: event.actor,
    });
    if (out.length >= limit) break;
  }

  return out;
}
