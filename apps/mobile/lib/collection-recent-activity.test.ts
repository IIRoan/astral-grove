import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import type { CollectionActivityEvent } from '@riftbound/contracts';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import {
  createOptimisticActivityEvent,
  prependRecentActivity,
  recentAddsQueryCoversVariant,
  recordOptimisticCollectionActivity,
} from '@/lib/collection-recent-activity';

const actor = { userId: 'user_1', name: 'Roan', email: null };

function event(delta: number, id: string): CollectionActivityEvent {
  return {
    id,
    at: '2026-08-22T15:00:00.000Z',
    action: delta > 0 ? 'add' : 'remove',
    quantityDelta: delta,
    quantityAfter: 1,
    isFoil: false,
    actor,
  };
}

describe('recentAddsQueryCoversVariant', () => {
  test('matches a variant inside the cached card key', () => {
    expect(
      recentAddsQueryCoversVariant(
        collectionQueryKeys.recentAdds(['OGN-001', 'OGN-001a']),
        'OGN-001'
      )
    ).toBe(true);
    expect(
      recentAddsQueryCoversVariant(
        collectionQueryKeys.recentAdds(['OGN-001', 'OGN-001a']),
        'OGN-999'
      )
    ).toBe(false);
  });
});

describe('prependRecentActivity', () => {
  test('preserves paginated history while updating the compact preview', () => {
    const client = new QueryClient();
    const historyKey = collectionQueryKeys.activityHistory(['OGN-001']);
    const history = { pages: [{ data: [] }], pageParams: [null] };
    client.setQueryData(historyKey, history);
    const previewKey = collectionQueryKeys.recentAdds(['OGN-001']);
    client.setQueryData(previewKey, []);
    const incoming = createOptimisticActivityEvent({
      delta: 1,
      quantityAfter: 1,
      isFoil: false,
      actor,
    });

    prependRecentActivity(client, 'OGN-001', incoming);

    expect(client.getQueryData(historyKey)).toEqual(history);
    expect(client.getQueryData(previewKey)).toEqual([incoming]);
  });

  test('inserts newest first and keeps three lines', () => {
    const client = new QueryClient();
    const key = collectionQueryKeys.recentAdds(['OGN-001', 'OGN-002']);
    client.setQueryData(key, [
      event(1, '11111111-1111-4111-8111-111111111111'),
      event(1, '22222222-2222-4222-8222-222222222222'),
      event(-1, '33333333-3333-4333-8333-333333333333'),
    ]);

    const incoming = createOptimisticActivityEvent({
      delta: 1,
      quantityAfter: 2,
      isFoil: true,
      actor,
      at: new Date('2026-08-22T16:00:00.000Z'),
    });
    prependRecentActivity(client, 'OGN-001', incoming);

    const next = client.getQueryData<CollectionActivityEvent[]>(key) ?? [];
    expect(next).toHaveLength(3);
    expect(next[0]?.id).toBe(incoming.id);
    expect(next[0]?.isFoil).toBe(true);
    expect(next[2]?.id).toBe('22222222-2222-4222-8222-222222222222');
  });

  test('does not touch a log for a different card', () => {
    const client = new QueryClient();
    const other = collectionQueryKeys.recentAdds(['VEN-010']);
    client.setQueryData(other, [event(1, '11111111-1111-4111-8111-111111111111')]);
    prependRecentActivity(
      client,
      'OGN-001',
      createOptimisticActivityEvent({
        delta: 1,
        quantityAfter: 1,
        isFoil: false,
        actor,
      })
    );
    expect(client.getQueryData<CollectionActivityEvent[]>(other)).toHaveLength(1);
  });

  test('does not seed a one-event list when the matching query has not loaded', () => {
    const client = new QueryClient();
    const key = collectionQueryKeys.recentAdds(['OGN-001', 'OGN-002']);
    client.getQueryCache().build(client, { queryKey: key });

    prependRecentActivity(
      client,
      'OGN-001',
      createOptimisticActivityEvent({
        delta: 1,
        quantityAfter: 1,
        isFoil: false,
        actor,
      })
    );

    expect(client.getQueryData(key)).toBeUndefined();
  });

  test('prepends onto an empty loaded log', () => {
    const client = new QueryClient();
    const key = collectionQueryKeys.recentAdds(['OGN-001']);
    client.setQueryData(key, []);
    const incoming = createOptimisticActivityEvent({
      delta: 1,
      quantityAfter: 1,
      isFoil: false,
      actor,
    });
    prependRecentActivity(client, 'OGN-001', incoming);
    expect(client.getQueryData(key)).toEqual([incoming]);
  });
});

describe('recordOptimisticCollectionActivity', () => {
  test('skips a zero delta', () => {
    const client = new QueryClient();
    const key = collectionQueryKeys.recentAdds(['OGN-001']);
    client.setQueryData(key, []);
    recordOptimisticCollectionActivity(client, {
      variantNumber: 'OGN-001',
      previousQuantity: 2,
      nextQuantity: 2,
      isFoil: false,
      actor,
    });
    expect(client.getQueryData<CollectionActivityEvent[]>(key)).toEqual([]);
  });

  test('does not invent history when the card log is still in flight', () => {
    const client = new QueryClient();
    const key = collectionQueryKeys.recentAdds(['OGN-001']);
    client.getQueryCache().build(client, { queryKey: key });
    recordOptimisticCollectionActivity(client, {
      variantNumber: 'OGN-001',
      previousQuantity: 0,
      nextQuantity: 1,
      isFoil: false,
      actor,
    });
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
