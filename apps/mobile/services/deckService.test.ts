import { describe, expect, mock, test } from 'bun:test';
import { createEmptyDeck } from '@/lib/deck-card';
import type { DeckListItem } from '@riftbound/contracts';

const upsertCalls: string[] = [];

mock.module('@/services/remoteDeckService', () => ({
  fetchRemoteDeck: async () => null,
  fetchRemoteDecks: async () => ({ data: [] }),
  remoteDeleteDeck: async () => undefined,
  remoteImportDeck: async () => {
    throw new Error('unused');
  },
  remoteUpsertDeck: async (deck: { id: string }) => {
    upsertCalls.push(`deck:${deck.id}`);
    return deck as DeckListItem;
  },
  remoteUpsertDeckVersion: async (
    deckId: string,
    versionId: string,
    deck: { id: string }
  ) => {
    upsertCalls.push(`${deckId}:${versionId}`);
    return { ...deck, versionId, source: 'owned', readOnly: false } as DeckListItem;
  },
  isRemoteDeckReadOnlyError: () => false,
}));

const { flushEditorDeckSave, flushRemoteDeckSave, queueRemoteDeckSave } =
  await import('./deckService');

describe('version-scoped deck save queue', () => {
  test('flushes sibling versions to distinct PUT paths', async () => {
    upsertCalls.length = 0;
    const base = createEmptyDeck('Queue');
    const versionA = { ...base, versionId: 'dver_a', updatedAt: 1 };
    const versionB = { ...base, versionId: 'dver_b', updatedAt: 2 };

    queueRemoteDeckSave(versionA);
    queueRemoteDeckSave(versionB);

    await flushRemoteDeckSave(base.id, 'dver_a');
    await flushRemoteDeckSave(base.id, 'dver_b');

    expect(upsertCalls).toEqual([`${base.id}:dver_a`, `${base.id}:dver_b`]);
  });

  test('flushEditorDeckSave queues the current list before creating a branch', async () => {
    upsertCalls.length = 0;
    const deck = { ...createEmptyDeck('Branch'), versionId: 'dver_a', updatedAt: 5 };
    await flushEditorDeckSave(deck);
    expect(upsertCalls).toEqual([`${deck.id}:dver_a`]);
  });
});
