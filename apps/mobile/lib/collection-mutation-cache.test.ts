import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import {
  getOwnershipRecord,
  type CollectionEntrySeed,
} from '@/lib/collection-optimistic-cache';
import {
  applyOptimisticCollectionQuantity,
  beginOptimisticCollectionMutation,
  rollbackOptimisticCollectionMutation,
  settleOptimisticCollectionMutation,
} from '@/lib/collection-mutation-cache';

const seed: CollectionEntrySeed = {
  name: 'Ahri',
  imageUrl: '',
  setCode: 'OGN',
  rarity: 'Rare',
  type: 'Legend',
  variantLabel: 'Standard',
  isFoil: false,
};
function add(
  client: QueryClient,
  variantNumber: string,
  quantity: number,
  isFoil = false,
  relative = true
) {
  const mutation = beginOptimisticCollectionMutation(client);
  applyOptimisticCollectionQuantity(
    client,
    mutation,
    variantNumber,
    quantity,
    seed,
    isFoil,
    relative
  );
  return mutation;
}

describe('overlapping collection mutations', () => {
  test('a failed add leaves another pending card intact', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    add(client, 'OGN-002', 1);
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(0);
    expect(getOwnershipRecord(client)['OGN-002']).toBe(1);
  });
  test('a failed add leaves a later add of the same finish intact', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    add(client, 'OGN-001', 2);
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(1);
  });
  test('out-of-order failures remove both failed increments', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    const second = add(client, 'OGN-001', 2);
    rollbackOptimisticCollectionMutation(client, second);
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(0);
    expect(client.getQueryData(collectionQueryKeys.all)).toEqual([]);
  });
  test('standard rollback preserves a pending foil add', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    add(client, 'OGN-001', 1, true);
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001::std']).toBe(0);
    expect(getOwnershipRecord(client)['OGN-001::foil']).toBe(1);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(1);
  });
  test('a later absolute quantity supersedes an earlier failed add', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    add(client, 'OGN-001', 4, false, false);
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(4);
  });
  test('a failed absolute quantity replays a later relative edit from the original quantity', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 4, false, false);
    add(client, 'OGN-001', 5);
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(1);
  });
  test('settled successes stay available for an earlier pending rollback', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    const second = add(client, 'OGN-001', 2);
    expect(settleOptimisticCollectionMutation(client, second)).toBeNull();
    rollbackOptimisticCollectionMutation(client, first);
    expect(getOwnershipRecord(client)['OGN-001']).toBe(1);
    expect(settleOptimisticCollectionMutation(client, first)).toEqual(['OGN-001']);
  });
  test('reconciliation waits for the last request even if it succeeds', () => {
    const client = new QueryClient();
    const first = add(client, 'OGN-001', 1);
    const second = add(client, 'OGN-002', 1);
    rollbackOptimisticCollectionMutation(client, first);
    expect(settleOptimisticCollectionMutation(client, first)).toBeNull();
    expect(settleOptimisticCollectionMutation(client, second)).toEqual([
      'OGN-001',
      'OGN-002',
    ]);
    const next = add(client, 'OGN-002', 2);
    rollbackOptimisticCollectionMutation(client, next);
    expect(getOwnershipRecord(client)['OGN-002']).toBe(1);
  });
});
