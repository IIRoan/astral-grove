import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  ne,
  type SQL,
} from 'drizzle-orm';
import type {
  CollectionAuditAction,
  CollectionAuditEvent,
  CollectionAuditListQuery,
  CollectionActivityEvent,
} from '@riftbound/contracts';
import {
  CardCondition,
  RECENT_COLLECTION_ACTIVITY_LIMIT,
  takeRecentCollectionActivity,
} from '@riftbound/contracts';
import { user as userTable } from '../db/auth-schema.js';
import type { Database } from '../db/client.js';
import { collectionAuditEvents } from '../db/schema.js';

export type CollectionAuditWrite = {
  collectionId: string;
  actorUserId: string;
  action: CollectionAuditAction;
  variantNumber?: string | null;
  condition?: string | null;
  language?: string | null;
  isFoil?: boolean | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type CollectionAuditActorRef = {
  userId: string;
  action: CollectionAuditAction;
  metadata?: Record<string, unknown>;
};

function quantityDelta(
  before: number | null | undefined,
  after: number | null | undefined
): number | null {
  if (before == null || after == null) return null;
  return after - before;
}

function toAuditEvent(row: {
  id: string;
  collectionId: string | null;
  action: string;
  variantNumber: string | null;
  condition: string | null;
  language: string | null;
  isFoil: boolean | null;
  quantityBefore: number | null;
  quantityAfter: number | null;
  quantityDelta: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actorUserId: string;
  actorName: string | null;
  actorEmail: string | null;
}): CollectionAuditEvent {
  const condition = row.condition
    ? CardCondition.safeParse(row.condition).success
      ? CardCondition.parse(row.condition)
      : null
    : null;

  return {
    id: row.id,
    collectionId: row.collectionId,
    action: row.action as CollectionAuditAction,
    variantNumber: row.variantNumber,
    condition,
    language: row.language,
    isFoil: row.isFoil,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    quantityDelta: row.quantityDelta,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    actor: {
      userId: row.actorUserId,
      name: row.actorName,
      email: row.actorEmail,
    },
  };
}

export class CollectionAuditService {
  constructor(private readonly db: Database) {}

  async record(event: CollectionAuditWrite): Promise<void> {
    await this.recordMany([event]);
  }

  async recordMany(events: CollectionAuditWrite[]): Promise<void> {
    if (events.length === 0) return;

    await this.db.insert(collectionAuditEvents).values(
      events.map((event) => ({
        collectionId: event.collectionId,
        actorUserId: event.actorUserId,
        action: event.action,
        variantNumber: event.variantNumber ?? null,
        condition: event.condition ?? null,
        language: event.language ?? null,
        isFoil: event.isFoil ?? null,
        quantityBefore: event.quantityBefore ?? null,
        quantityAfter: event.quantityAfter ?? null,
        quantityDelta: quantityDelta(event.quantityBefore, event.quantityAfter),
        metadata: event.metadata ?? null,
      }))
    );
  }

  async listForCollection(
    collectionId: string,
    query: CollectionAuditListQuery,
    viewerUserId: string
  ): Promise<{ events: CollectionAuditEvent[]; total: number; hasMore: boolean }> {
    const filters: SQL[] = [eq(collectionAuditEvents.collectionId, collectionId)];

    if (query.mine) {
      filters.push(eq(collectionAuditEvents.actorUserId, viewerUserId));
    } else if (query.actorUserId) {
      filters.push(eq(collectionAuditEvents.actorUserId, query.actorUserId));
    }
    if (query.variantNumber) {
      filters.push(eq(collectionAuditEvents.variantNumber, query.variantNumber));
    }
    if (query.action) {
      filters.push(eq(collectionAuditEvents.action, query.action));
    }
    if (query.before) {
      filters.push(lt(collectionAuditEvents.createdAt, new Date(query.before)));
    }

    return this.page(filters, query.limit);
  }

  async listForActor(
    actorUserId: string,
    query: CollectionAuditListQuery
  ): Promise<{ events: CollectionAuditEvent[]; total: number; hasMore: boolean }> {
    const filters: SQL[] = [eq(collectionAuditEvents.actorUserId, actorUserId)];

    if (query.variantNumber) {
      filters.push(eq(collectionAuditEvents.variantNumber, query.variantNumber));
    }
    if (query.action) {
      filters.push(eq(collectionAuditEvents.action, query.action));
    }
    if (query.before) {
      filters.push(lt(collectionAuditEvents.createdAt, new Date(query.before)));
    }

    return this.page(filters, query.limit);
  }

  async recentAddsForVariants(
    collectionId: string,
    variantNumbers: string[]
  ): Promise<CollectionActivityEvent[]> {
    const unique = [
      ...new Set(variantNumbers.map((value) => value.trim()).filter(Boolean)),
    ].slice(0, 200);
    if (unique.length === 0) return [];

    const rows = await this.db
      .select({
        id: collectionAuditEvents.id,
        action: collectionAuditEvents.action,
        quantityDelta: collectionAuditEvents.quantityDelta,
        quantityAfter: collectionAuditEvents.quantityAfter,
        isFoil: collectionAuditEvents.isFoil,
        createdAt: collectionAuditEvents.createdAt,
        actorUserId: collectionAuditEvents.actorUserId,
        actorName: userTable.name,
        actorEmail: userTable.email,
      })
      .from(collectionAuditEvents)
      .innerJoin(userTable, eq(collectionAuditEvents.actorUserId, userTable.id))
      .where(
        and(
          eq(collectionAuditEvents.collectionId, collectionId),
          inArray(collectionAuditEvents.variantNumber, unique),
          isNotNull(collectionAuditEvents.quantityDelta),
          ne(collectionAuditEvents.quantityDelta, 0)
        )
      )
      .orderBy(desc(collectionAuditEvents.createdAt), desc(collectionAuditEvents.id))
      .limit(RECENT_COLLECTION_ACTIVITY_LIMIT);

    return takeRecentCollectionActivity(
      rows.map((row) => ({
        id: row.id,
        action: row.action,
        quantityDelta: row.quantityDelta,
        quantityAfter: row.quantityAfter,
        isFoil: row.isFoil,
        createdAt: row.createdAt.toISOString(),
        actor: {
          userId: row.actorUserId,
          name: row.actorName,
          email: row.actorEmail,
        },
      }))
    );
  }

  private async page(
    filters: SQL[],
    limit: number
  ): Promise<{ events: CollectionAuditEvent[]; total: number; hasMore: boolean }> {
    const where = and(...filters);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(collectionAuditEvents)
      .where(where);

    const rows = await this.db
      .select({
        id: collectionAuditEvents.id,
        collectionId: collectionAuditEvents.collectionId,
        action: collectionAuditEvents.action,
        variantNumber: collectionAuditEvents.variantNumber,
        condition: collectionAuditEvents.condition,
        language: collectionAuditEvents.language,
        isFoil: collectionAuditEvents.isFoil,
        quantityBefore: collectionAuditEvents.quantityBefore,
        quantityAfter: collectionAuditEvents.quantityAfter,
        quantityDelta: collectionAuditEvents.quantityDelta,
        metadata: collectionAuditEvents.metadata,
        createdAt: collectionAuditEvents.createdAt,
        actorUserId: collectionAuditEvents.actorUserId,
        actorName: userTable.name,
        actorEmail: userTable.email,
      })
      .from(collectionAuditEvents)
      .innerJoin(userTable, eq(collectionAuditEvents.actorUserId, userTable.id))
      .where(where)
      .orderBy(desc(collectionAuditEvents.createdAt), desc(collectionAuditEvents.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    return {
      events: pageRows.map(toAuditEvent),
      total: Number(totalRow?.total ?? 0),
      hasMore,
    };
  }
}
