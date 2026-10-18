import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CollectionAuditListResponse,
  CollectionActivityHistoryResponse,
  CollectionItemResponse,
  CollectionRecentAddsResponse,
} from '@riftbound/contracts';
import { eq, sql } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionAuditEvents, collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const stamp = Date.now();
const password = 'test-password-12345';
let cookie = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-coll-audit-%');
  cookie = await signUpTestUser({
    email: `test-db-coll-audit-${stamp}@test.riftbound.dev`,
    password,
    name: 'Collection Audit User',
  });
  const session = await (await authFetch('/api/auth/get-session', { cookie })).json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-coll-audit-%');
});

describe('collection audit trail', () => {
  test('records actor + before/after quantities on add and remove', async () => {
    const variantNumber = 'OGN-302';

    const addRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 2 }),
      }
    );
    expect(addRes.status).toBe(200);
    CollectionItemResponse.parse(await addRes.json());

    const removeRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(removeRes.status).toBe(200);

    const auditRes = await authFetch(
      `/api/v1/collection/audit?variantNumber=${encodeURIComponent(variantNumber)}`,
      { cookie }
    );
    expect(auditRes.status).toBe(200);
    const audit = CollectionAuditListResponse.parse(await auditRes.json());
    expect(audit.data.length).toBeGreaterThanOrEqual(2);

    const [latest, previous] = audit.data;
    expect(latest?.actor.userId).toBe(userId);
    expect(latest?.action).toBe('remove');
    expect(latest?.variantNumber).toBe(variantNumber);
    expect(latest?.quantityBefore).toBe(2);
    expect(latest?.quantityAfter).toBe(1);
    expect(latest?.quantityDelta).toBe(-1);

    expect(previous?.action).toBe('add');
    expect(previous?.quantityBefore).toBe(0);
    expect(previous?.quantityAfter).toBe(2);
    expect(previous?.quantityDelta).toBe(2);

    const mineRes = await authFetch('/api/v1/collection/audit/me?limit=10', {
      cookie,
    });
    expect(mineRes.status).toBe(200);
    const mine = CollectionAuditListResponse.parse(await mineRes.json());
    expect(mine.data.every((event) => event.actor.userId === userId)).toBe(true);

    const { db } = getContext();
    const [membership] = await db
      .select({ collectionId: collectionMembers.collectionId })
      .from(collectionMembers)
      .where(eq(collectionMembers.userId, userId))
      .limit(1);
    expect(membership).toBeDefined();

    const rows = await db
      .select()
      .from(collectionAuditEvents)
      .where(eq(collectionAuditEvents.collectionId, membership!.collectionId));
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('returns the latest add and remove events for a card', async () => {
    const variantNumber = 'OGN-310';

    const first = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(first.status).toBe(200);

    const second = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(second.status).toBe(200);

    const removeRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(removeRes.status).toBe(200);

    const recentRes = await authFetch('/api/v1/collection/recent-adds', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ variantNumbers: [variantNumber] }),
    });
    expect(recentRes.status).toBe(200);
    const recent = CollectionRecentAddsResponse.parse(await recentRes.json());
    expect(recent.data.length).toBeGreaterThanOrEqual(2);
    expect(recent.data[0]?.quantityDelta).toBe(-1);
    expect(recent.data[0]?.action).toBe('remove');
    expect(recent.data[0]?.actor.userId).toBe(userId);
    expect(recent.data.some((event) => event.quantityDelta > 0)).toBe(true);
    const [latest, previous] = recent.data;
    expect(latest?.at && previous?.at ? latest.at >= previous.at : false).toBe(true);
  });

  test('rejects unauthenticated audit reads', async () => {
    const res = await authFetch('/api/v1/collection/audit');
    expect(res.status).toBe(401);
  });

  test('pages older card activity without losing timestamp ties or leaking another collection', async () => {
    const { db } = getContext();
    const [membership] = await db
      .select()
      .from(collectionMembers)
      .where(eq(collectionMembers.userId, userId))
      .limit(1);
    const variantNumber = `history-${stamp}`;
    const ids = Array.from({ length: 5 }, () => crypto.randomUUID())
      .sort()
      .reverse();
    await db.insert(collectionAuditEvents).values(
      ids.map((id, index) => ({
        id,
        collectionId: membership!.collectionId,
        actorUserId: userId,
        action: index % 2 === 0 ? 'add' : 'remove',
        variantNumber,
        isFoil: index % 2 === 0,
        quantityBefore: 2,
        quantityAfter: index % 2 === 0 ? 3 : 1,
        quantityDelta: index % 2 === 0 ? 1 : -1,
        createdAt: sql`'2026-10-09T12:00:00.123456Z'::timestamptz`,
      }))
    );

    const seen: string[] = [];
    let cursor: { at: string; id: string } | null = null;
    do {
      const response = await authFetch('/api/v1/collection/activity-history', {
        method: 'POST',
        cookie,
        body: JSON.stringify({
          variantNumbers: [variantNumber],
          limit: 2,
          ...(cursor ? { cursor } : {}),
        }),
      });
      expect(response.status).toBe(200);
      const page = CollectionActivityHistoryResponse.parse(await response.json());
      seen.push(...page.data.map((event) => event.id));
      expect(page.meta.hasMore).toBe(page.meta.nextCursor !== null);
      cursor = page.meta.nextCursor;
      if (cursor) expect(cursor.at).toBe('2026-10-09T12:00:00.123456Z');
    } while (cursor && seen.length < 10);
    expect(seen).toEqual(ids);

    const otherCookie = await signUpTestUser({
      email: `test-db-coll-audit-other-${stamp}@test.riftbound.dev`,
      password,
      name: 'Other collector',
    });
    const otherResponse = await authFetch('/api/v1/collection/activity-history', {
      method: 'POST',
      cookie: otherCookie,
      body: JSON.stringify({ variantNumbers: [variantNumber] }),
    });
    expect(otherResponse.status).toBe(200);
    expect(
      CollectionActivityHistoryResponse.parse(await otherResponse.json()).data
    ).toEqual([]);
  });

  test('rejects unauthenticated history reads and oversized pages', async () => {
    const response = await authFetch('/api/v1/collection/activity-history', {
      method: 'POST',
      body: JSON.stringify({ variantNumbers: ['OGN-001'] }),
    });
    expect(response.status).toBe(401);
    const invalid = await authFetch('/api/v1/collection/activity-history', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ variantNumbers: ['OGN-001'], limit: 51 }),
    });
    expect(invalid.status).toBe(422);
  });
});
