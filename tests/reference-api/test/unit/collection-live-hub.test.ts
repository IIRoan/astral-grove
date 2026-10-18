import { describe, expect, test } from 'bun:test';
import { CollectionLiveHub } from '../../src/services/collection-live-hub.js';

describe('CollectionLiveHub', () => {
  test('delivers published events to subscribers of that collection only', () => {
    const hub = new CollectionLiveHub();
    const seenA: string[] = [];
    const seenB: string[] = [];

    const unsubA = hub.subscribe('11111111-1111-1111-1111-111111111111', (event) => {
      seenA.push(event.reason);
    });
    const unsubB = hub.subscribe('22222222-2222-2222-2222-222222222222', (event) => {
      seenB.push(event.reason);
    });

    hub.publish('11111111-1111-1111-1111-111111111111', 'add', 'user-a');
    hub.publish('11111111-1111-1111-1111-111111111111', 'remove', 'user-b');
    hub.publish('22222222-2222-2222-2222-222222222222', 'upsert', 'user-c');

    expect(seenA).toEqual(['add', 'remove']);
    expect(seenB).toEqual(['upsert']);
    expect(hub.subscriberCount('11111111-1111-1111-1111-111111111111')).toBe(1);

    unsubA();
    unsubB();
    expect(hub.subscriberCount('11111111-1111-1111-1111-111111111111')).toBe(0);
  });

  test('unsubscribe stops further deliveries', () => {
    const hub = new CollectionLiveHub();
    const collectionId = '33333333-3333-3333-3333-333333333333';
    let count = 0;
    const unsub = hub.subscribe(collectionId, () => {
      count += 1;
    });
    hub.publish(collectionId, 'add', 'u1');
    unsub();
    hub.publish(collectionId, 'add', 'u1');
    expect(count).toBe(1);
  });

  test('rejects additional subscribers past the per-collection cap', () => {
    const hub = new CollectionLiveHub(1);
    const collectionId = '44444444-4444-4444-4444-444444444444';
    const unsub = hub.subscribe(collectionId, () => undefined);
    expect(() => hub.subscribe(collectionId, () => undefined)).toThrow(
      'Too many live listeners'
    );
    unsub();
  });
});
