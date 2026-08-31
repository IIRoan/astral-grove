import { describe, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  bumpCollectionMutationGeneration,
  collectionSnapshotIsStale,
  getCollectionMutationGeneration,
} from '@/hooks/collectionMutationGeneration';
import { collectionMutationKey } from '@/src/api/queryKeys';

describe('collectionMutationGeneration', () => {
  test('bumps per QueryClient so stale fetches can detect races', () => {
    const client = new QueryClient();
    expect(getCollectionMutationGeneration(client)).toBe(0);
    expect(bumpCollectionMutationGeneration(client)).toBe(1);
    expect(bumpCollectionMutationGeneration(client)).toBe(2);
    expect(getCollectionMutationGeneration(client)).toBe(2);

    const other = new QueryClient();
    expect(getCollectionMutationGeneration(other)).toBe(0);
  });
});

describe('collectionSnapshotIsStale', () => {
  test('keeps snapshots that started idle and stayed idle', () => {
    const client = new QueryClient();
    expect(collectionSnapshotIsStale(client, 0, false)).toBe(false);
  });

  test('discards snapshots when generation advanced during the fetch', () => {
    const client = new QueryClient();
    const generation = getCollectionMutationGeneration(client);
    bumpCollectionMutationGeneration(client);
    expect(collectionSnapshotIsStale(client, generation, false)).toBe(true);
  });

  test('discards snapshots that started during a mutation even after it settles', () => {
    const client = new QueryClient();
    bumpCollectionMutationGeneration(client);
    expect(collectionSnapshotIsStale(client, 1, true)).toBe(true);
  });

  test('discards snapshots while a collection mutation is still in flight', async () => {
    const client = new QueryClient();
    let resolveMutation!: () => void;
    const mutationPromise = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    const mutation = client.getMutationCache().build(client, {
      mutationKey: collectionMutationKey,
      mutationFn: () => mutationPromise,
    });
    const run = mutation.execute(undefined);
    const generation = getCollectionMutationGeneration(client);

    expect(collectionSnapshotIsStale(client, generation, false)).toBe(true);

    resolveMutation();
    await run;
    expect(collectionSnapshotIsStale(client, generation, false)).toBe(false);
  });
});
