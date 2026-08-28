import { Elysia, sse } from 'elysia';
import {
  chunkArray,
  COLLECTION_VARIANT_LOOKUP_BATCH_SIZE,
  CollectionAdjustRequest,
  CollectionAuditListQuery,
  CollectionAuditListResponse,
  CollectionBatchSyncRequest,
  CollectionBatchSyncResponse,
  CollectionClearResponse,
  CollectionDeleteQuery,
  CollectionImportRequest,
  CollectionImportResponse,
  CollectionItemResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
  CollectionRecentAddsResponse,
  CollectionUpsertRequest,
  CollectionVariantNumbersRequest,
  OkResponse,
  type CollectionLiveChangeReason,
  type CollectionLiveChangedEvent,
} from '@riftbound/contracts';
import type { CollectionItem as CollectionItemDto } from '@riftbound/contracts';
import type { Auth } from '../auth.js';
import { logActionFailure } from '../lib/logger.js';
import { getSessionUser, unauthorized } from '../lib/session.js';
import type { Database } from '../db/client.js';
import { ensureCollectionMembership } from '../services/collection-membership.js';
import type { CollectionService } from '../services/collection-service.js';
import { CollectionAuditService } from '../services/collection-audit-service.js';
import {
  collectionLiveHub,
  CollectionLiveLimitError,
  type CollectionLiveHub,
} from '../services/collection-live-hub.js';
import { mergeRequestBody, parseRequest } from '../lib/request-validation.js';

async function quantitiesForVariantLookup(
  collection: CollectionService,
  collectionId: string,
  variantNumbers: readonly string[]
) {
  const unique = [...new Set(variantNumbers)];
  if (unique.length === 0) return [];

  const rows: Array<{ variantNumber: string; isFoil: boolean; quantity: number }> = [];
  for (const chunk of chunkArray(unique, COLLECTION_VARIANT_LOOKUP_BATCH_SIZE)) {
    rows.push(...(await collection.quantitiesForVariants(collectionId, chunk)));
  }
  return rows;
}

const HEARTBEAT_MS = 25_000;

function collectionItemResponse(
  action: string,
  item: CollectionItemDto | null,
  context?: Record<string, unknown>
) {
  if (!item) return { data: null };
  const parsed = CollectionItemResponse.safeParse({ data: item });
  if (!parsed.success) {
    logActionFailure(action, parsed.error, {
      ...context,
      variantNumber: item.variantNumber,
    });
    return { data: null };
  }
  return parsed.data;
}

function parseCollectionList(
  action: string,
  result: Awaited<ReturnType<CollectionService['listForCollection']>>
) {
  const parsed = CollectionListResponse.safeParse({
    data: result.items,
    meta: { total: result.total, totalQuantity: result.totalQuantity },
  });
  if (!parsed.success) {
    logActionFailure(action, parsed.error, { total: result.total });
    throw new Error('Collection list response validation failed');
  }
  return parsed.data;
}

function notifyLive(
  hub: CollectionLiveHub,
  collectionId: string,
  reason: CollectionLiveChangeReason,
  actorUserId: string
) {
  hub.publish(collectionId, reason, actorUserId);
}

function streamCollectionLiveEvents(
  request: Request,
  collectionId: string,
  liveHub: CollectionLiveHub
) {
  const queue: CollectionLiveChangedEvent[] = [];
  let wake: (() => void) | null = null;
  const push = (event: CollectionLiveChangedEvent) => {
    queue.push(event);
    wake?.();
  };
  const unsub = liveHub.subscribe(collectionId, push);
  const onAbort = () => {
    wake?.();
  };
  request.signal.addEventListener('abort', onAbort);

  return (async function* () {
    try {
      yield sse({
        event: 'ready',
        data: { type: 'ready', collectionId },
      });

      while (!request.signal.aborted) {
        const waited = await Promise.race([
          new Promise<'event'>((resolve) => {
            wake = () => {
              resolve('event');
            };
            if (queue.length > 0) resolve('event');
          }),
          new Promise<'heartbeat'>((resolve) => {
            setTimeout(() => {
              resolve('heartbeat');
            }, HEARTBEAT_MS);
          }),
        ]);
        wake = null;

        while (queue.length > 0) {
          const event = queue.shift();
          if (!event) break;
          yield sse({
            event: event.type,
            data: event,
          });
        }

        if (waited === 'heartbeat' && !request.signal.aborted) {
          yield sse({
            event: 'heartbeat',
            data: { type: 'heartbeat', at: new Date().toISOString() },
          });
        }
      }
    } finally {
      request.signal.removeEventListener('abort', onAbort);
      unsub();
    }
  })();
}

export function createCollectionRoutes(
  collection: CollectionService,
  auth: Auth,
  db: Database,
  liveHub: CollectionLiveHub = collectionLiveHub,
  audit: CollectionAuditService = new CollectionAuditService(db)
) {
  return new Elysia({ prefix: '/api/v1/collection' })
    .get('/', { detail: { tags: ['collection'] } }, async ({ request, set }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const { collectionId } = await ensureCollectionMembership(db, user.id);
      const result = await collection.listForCollection(collectionId);
      return parseCollectionList('collection.list', result);
    })
    .get(
      '/audit',
      { detail: { tags: ['collection'] } },
      async ({ request, set, query }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const parsed = parseRequest(CollectionAuditListQuery, query);
        const result = await audit.listForCollection(collectionId, parsed, user.id);
        return CollectionAuditListResponse.parse({
          data: result.events,
          meta: {
            total: result.total,
            limit: parsed.limit,
            hasMore: result.hasMore,
          },
        });
      }
    )
    .get(
      '/audit/me',
      { detail: { tags: ['collection'] } },
      async ({ request, set, query }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const parsed = parseRequest(CollectionAuditListQuery, query);
        const result = await audit.listForActor(user.id, parsed);
        return CollectionAuditListResponse.parse({
          data: result.events,
          meta: {
            total: result.total,
            limit: parsed.limit,
            hasMore: result.hasMore,
          },
        });
      }
    )
    .post(
      '/recent-adds',
      { detail: { tags: ['collection'] } },
      async ({ request, set, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const { variantNumbers } = parseRequest(CollectionVariantNumbersRequest, body);
        const rows = await audit.recentAddsForVariants(collectionId, variantNumbers);
        return CollectionRecentAddsResponse.parse({ data: rows });
      }
    )
    .get('/events', { detail: { tags: ['collection'] } }, async ({ request, set }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const { collectionId } = await ensureCollectionMembership(db, user.id);
      try {
        return streamCollectionLiveEvents(request, collectionId, liveHub);
      } catch (error) {
        if (error instanceof CollectionLiveLimitError) {
          set.status = 429;
          return { error: 'RATE_LIMITED', message: 'Too many live listeners' };
        }
        throw error;
      }
    })
    .post(
      '/quantities',
      { detail: { tags: ['collection'] } },
      async ({ request, set, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const { variantNumbers } = parseRequest(CollectionVariantNumbersRequest, body);
        const rows = await quantitiesForVariantLookup(
          collection,
          collectionId,
          variantNumbers
        );
        return CollectionQuantitiesResponse.parse({ data: rows });
      }
    )
    .put(
      '/:variantNumber',
      { detail: { tags: ['collection'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const parsed = parseRequest(
          CollectionUpsertRequest,
          mergeRequestBody(body, { variantNumber: params.variantNumber })
        );
        const item = await collection.upsert(
          collectionId,
          {
            variantNumber: parsed.variantNumber,
            quantity: parsed.quantity,
            condition: parsed.condition,
            language: parsed.language,
            ...(parsed.isFoil === undefined ? {} : { isFoil: parsed.isFoil }),
            notes: parsed.notes ?? null,
            isGraded: parsed.isGraded ?? false,
            gradeCompany: parsed.gradeCompany ?? null,
            gradeScore: parsed.gradeScore ?? null,
            acquiredAt: parsed.acquiredAt ?? null,
            acquiredPriceCents: parsed.acquiredPriceCents ?? null,
          },
          { userId: user.id, action: 'upsert' }
        );
        notifyLive(liveHub, collectionId, 'upsert', user.id);
        if (!item) {
          return { data: null };
        }
        return collectionItemResponse('collection.upsert', item, {
          variantNumber: parsed.variantNumber,
        });
      }
    )
    .post(
      '/:variantNumber/add',
      { detail: { tags: ['collection'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const parsed = parseRequest(CollectionAdjustRequest, body ?? {});
        const item = await collection.adjustQuantity(
          collectionId,
          params.variantNumber,
          parsed.delta,
          {
            condition: parsed.condition,
            language: parsed.language,
            ...(parsed.isFoil === undefined ? {} : { isFoil: parsed.isFoil }),
          },
          { userId: user.id, action: 'add' }
        );
        notifyLive(liveHub, collectionId, 'add', user.id);
        if (!item) return { data: null };
        return collectionItemResponse('collection.add', item, {
          variantNumber: params.variantNumber,
          delta: parsed.delta,
        });
      }
    )
    .post(
      '/:variantNumber/remove',
      { detail: { tags: ['collection'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const parsed = parseRequest(CollectionAdjustRequest, body ?? {});
        const item = await collection.adjustQuantity(
          collectionId,
          params.variantNumber,
          -parsed.delta,
          {
            condition: parsed.condition,
            language: parsed.language,
            ...(parsed.isFoil === undefined ? {} : { isFoil: parsed.isFoil }),
          },
          { userId: user.id, action: 'remove' }
        );
        notifyLive(liveHub, collectionId, 'remove', user.id);
        if (!item) return { data: null };
        return collectionItemResponse('collection.remove', item, {
          variantNumber: params.variantNumber,
          delta: parsed.delta,
        });
      }
    )
    .delete(
      '/:variantNumber',
      { detail: { tags: ['collection'] } },
      async ({ request, set, params, query }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const parsed = parseRequest(CollectionDeleteQuery, query);
        await collection.remove(
          collectionId,
          params.variantNumber,
          parsed.condition,
          parsed.language,
          parsed.isFoil,
          { userId: user.id, action: 'delete' }
        );
        notifyLive(liveHub, collectionId, 'delete', user.id);
        return OkResponse.parse({ data: { ok: true } });
      }
    )
    .delete('/all', { detail: { tags: ['collection'] } }, async ({ request, set }) => {
      if (process.env.NODE_ENV === 'production') {
        set.status = 404;
        return { error: 'Not found' };
      }
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const { collectionId } = await ensureCollectionMembership(db, user.id);
      const result = await collection.clearAll(collectionId, {
        userId: user.id,
        action: 'clear',
      });
      notifyLive(liveHub, collectionId, 'clear', user.id);
      return CollectionClearResponse.parse({ data: result });
    })
    .post(
      '/batch',
      { detail: { tags: ['collection'] } },
      async ({ request, set, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const { items } = parseRequest(CollectionBatchSyncRequest, body);
        const result = await collection.batchSync(collectionId, items, {
          userId: user.id,
          action: 'batch',
        });
        notifyLive(liveHub, collectionId, 'batch', user.id);
        return CollectionBatchSyncResponse.parse({ data: result });
      }
    )
    .get('/export', { detail: { tags: ['collection'] } }, async ({ request, set }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const { collectionId } = await ensureCollectionMembership(db, user.id);
      const csv = await collection.exportForCollection(collectionId);
      set.headers['content-type'] = 'text/csv; charset=utf-8';
      set.headers['content-disposition'] =
        'attachment; filename="piltover-collection-export.csv"';
      return csv;
    })
    .post(
      '/import',
      { detail: { tags: ['collection'] } },
      async ({ request, set, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const { collectionId } = await ensureCollectionMembership(db, user.id);
        const parsed = parseRequest(CollectionImportRequest, body);
        if (parsed.items && parsed.items.length > 0) {
          const result = await collection.importItems(
            collectionId,
            parsed.items.map((item) => ({
              variantNumber: item.variantNumber,
              quantity: item.quantity,
              condition: item.condition,
              language: item.language,
              ...(item.isFoil === undefined ? {} : { isFoil: item.isFoil }),
              notes: item.notes ?? null,
              isGraded: item.isGraded ?? false,
              gradeCompany: item.gradeCompany ?? null,
              gradeScore: item.gradeScore ?? null,
            })),
            { userId: user.id, action: 'import' }
          );
          notifyLive(liveHub, collectionId, 'import', user.id);
          return CollectionImportResponse.parse({ data: result });
        }
        if (!parsed.csv) {
          set.status = 400;
          return { error: 'Provide csv or items' };
        }
        const result = await collection.importCsv(collectionId, parsed.csv, {
          userId: user.id,
          action: 'import',
        });
        notifyLive(liveHub, collectionId, 'import', user.id);
        return CollectionImportResponse.parse({ data: result });
      }
    );
}
