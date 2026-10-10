import { describe, expect, test } from 'bun:test';
import {
  CollectionAuditAction,
  CollectionAuditEvent,
  CollectionAuditListQuery,
  CollectionAuditListResponse,
  CollectionActivityHistoryRequest,
  CollectionActivityHistoryResponse,
  CollectionRecentAddsResponse,
  takeRecentCollectionActivity,
} from './collection-audit.js';

describe('collection activity history pagination', () => {
  test('defaults to twenty events and bounds page size', () => {
    expect(
      CollectionActivityHistoryRequest.parse({ variantNumbers: ['OGN-001'] }).limit
    ).toBe(20);
    for (const limit of [0, 51, 1.5]) {
      expect(
        CollectionActivityHistoryRequest.safeParse({
          variantNumbers: ['OGN-001'],
          limit,
        }).success
      ).toBe(false);
    }
  });

  test('preserves a precise timestamp and event ID in the cursor', () => {
    const cursor = {
      at: '2026-10-09T12:00:00.123456Z',
      id: '11111111-1111-4111-8111-111111111111',
    };
    expect(
      CollectionActivityHistoryRequest.parse({
        variantNumbers: ['OGN-001'],
        cursor,
      }).cursor
    ).toEqual(cursor);
    expect(
      CollectionActivityHistoryResponse.parse({
        data: [],
        meta: { hasMore: false, nextCursor: null },
      }).meta.nextCursor
    ).toBeNull();
  });
});

describe('CollectionAuditAction', () => {
  test('accepts known mutation actions', () => {
    expect(CollectionAuditAction.parse('add')).toBe('add');
    expect(CollectionAuditAction.parse('share_merge')).toBe('share_merge');
  });
});

describe('CollectionAuditListQuery', () => {
  test('coerces limit and mine flags', () => {
    expect(CollectionAuditListQuery.parse({ limit: '25', mine: '1' })).toEqual({
      limit: 25,
      mine: true,
    });
    expect(CollectionAuditListQuery.parse({ mine: 'false' }).mine).toBe(false);
  });
});

describe('CollectionAuditEvent', () => {
  test('parses a full stack change event', () => {
    const event = CollectionAuditEvent.parse({
      id: '11111111-1111-4111-8111-111111111111',
      collectionId: '22222222-2222-4222-8222-222222222222',
      action: 'add',
      variantNumber: 'VEN-152',
      condition: 'near_mint',
      language: 'en',
      isFoil: true,
      quantityBefore: 0,
      quantityAfter: 1,
      quantityDelta: 1,
      metadata: null,
      createdAt: '2026-08-11T08:11:50.323Z',
      actor: {
        userId: 'user_1',
        name: 'roan',
        email: 'personal@roan.zip',
      },
    });
    expect(event.quantityDelta).toBe(1);
    expect(event.actor.email).toBe('personal@roan.zip');
  });
});

describe('CollectionAuditListResponse', () => {
  test('wraps events with pagination meta', () => {
    const parsed = CollectionAuditListResponse.parse({
      data: [],
      meta: { total: 0, limit: 50, hasMore: false },
    });
    expect(parsed.meta.hasMore).toBe(false);
  });
});

describe('takeRecentCollectionActivity', () => {
  const actor = { userId: 'user_1', name: 'roan', email: 'a@b.c' };

  test('returns newest add and remove events across finishes', () => {
    const rows = takeRecentCollectionActivity([
      {
        id: '33333333-3333-4333-8333-333333333333',
        action: 'remove',
        quantityDelta: -1,
        quantityAfter: 2,
        isFoil: true,
        createdAt: '2026-08-23T08:00:00.000Z',
        actor,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        action: 'add',
        quantityDelta: 2,
        quantityAfter: 3,
        isFoil: true,
        createdAt: '2026-08-22T15:00:00.000Z',
        actor,
      },
      {
        id: '11111111-1111-4111-8111-111111111111',
        action: 'add',
        quantityDelta: 1,
        quantityAfter: 1,
        isFoil: false,
        createdAt: '2026-08-20T10:00:00.000Z',
        actor,
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        action: 'add',
        quantityDelta: 1,
        quantityAfter: 1,
        isFoil: false,
        createdAt: '2026-08-18T09:00:00.000Z',
        actor,
      },
    ]);

    expect(rows.map((event) => event.quantityDelta)).toEqual([-1, 2, 1]);
    expect(rows[0]?.action).toBe('remove');
    expect(rows[0]?.isFoil).toBe(true);
  });

  test('parses the activity log envelope', () => {
    const parsed = CollectionRecentAddsResponse.parse({
      data: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          at: '2026-08-22T15:00:00.000Z',
          action: 'remove',
          quantityDelta: -1,
          quantityAfter: 0,
          isFoil: true,
          actor: { userId: 'user_1', name: 'roan', email: null },
        },
      ],
    });
    expect(parsed.data[0]?.quantityDelta).toBe(-1);
  });
});
