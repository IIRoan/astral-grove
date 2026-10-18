import { describe, expect, test } from 'bun:test';
import type { Database } from '../../src/db/client.js';
import { CollectionAuditService } from '../../src/services/collection-audit-service.js';

function auditWithRows(rows: unknown[]) {
  let requestedLimit = 0;
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: (value: number) => {
      requestedLimit = value;
      return Promise.resolve(rows);
    },
  };
  const db = { select: () => query } as unknown as Database;
  return {
    audit: new CollectionAuditService(db),
    requestedLimit: () => requestedLimit,
  };
}

const rows = [1, 2, 3].map((index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  action: 'add',
  quantityDelta: 1,
  quantityAfter: index,
  isFoil: false,
  createdAt: new Date('2026-10-09T12:00:00.123Z'),
  cursorAt: '2026-10-09T12:00:00.123456Z',
  actorUserId: 'test-user',
  actorName: 'Test',
  actorEmail: null,
}));

describe('collection activity history pages', () => {
  test('uses an overflow event to signal older activity without exposing it', async () => {
    const { audit, requestedLimit } = auditWithRows(rows);
    const result = await audit.activityHistoryForVariants('collection', {
      variantNumbers: ['OGN-001'],
      limit: 2,
    });
    expect(requestedLimit()).toBe(3);
    expect(result.data.map((event) => event.id)).toEqual(
      rows.slice(0, 2).map((row) => row.id)
    );
    expect(result.meta).toEqual({
      hasMore: true,
      nextCursor: { id: rows[1]!.id, at: '2026-10-09T12:00:00.123456Z' },
    });
  });

  test('ends pagination when the page has no overflow', async () => {
    const { audit } = auditWithRows(rows);
    const result = await audit.activityHistoryForVariants('collection', {
      variantNumbers: ['OGN-001'],
      limit: 3,
    });
    expect(result.data).toHaveLength(3);
    expect(result.meta).toEqual({ hasMore: false, nextCursor: null });
  });

  test('does not query for an empty card lookup', async () => {
    const { audit, requestedLimit } = auditWithRows(rows);
    expect(
      await audit.activityHistoryForVariants('collection', {
        variantNumbers: [],
        limit: 20,
      })
    ).toEqual({ data: [], meta: { hasMore: false, nextCursor: null } });
    expect(requestedLimit()).toBe(0);
  });
});
