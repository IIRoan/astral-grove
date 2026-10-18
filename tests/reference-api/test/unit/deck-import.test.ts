import { describe, expect, test } from 'bun:test';
import type { DeckListItem, StoredDeckPayload } from '@riftbound/contracts';
import { DeckService } from '../../src/services/deck-service.js';

const importedPayload: StoredDeckPayload = {
  id: 'upstream-deck-1',
  name: 'Imported Deck',
  description: 'From archive',
  createdAt: 1,
  updatedAt: 2,
  legend: null,
  champion: null,
  mainDeck: [],
  runes: [],
  battlefields: [],
  sideboard: [],
};

function createImportTestService(existingOwned: StoredDeckPayload[] = []) {
  const upsertCalls: StoredDeckPayload[] = [];
  const service = new DeckService({} as never);

  const deckSync = {
    getStoredDeckPayload: async (deckId: string) =>
      deckId === 'upstream-deck-1' ? importedPayload : null,
  };

  Object.assign(service as unknown as Record<string, unknown>, {
    deckSync,
    listOwnedPayloads: async () => existingOwned,
    upsert: async (_userId: string, deck: StoredDeckPayload): Promise<DeckListItem> => {
      upsertCalls.push(deck);
      return { ...deck, source: 'owned', readOnly: false };
    },
  });

  return { service, upsertCalls };
}

describe('DeckService.importFromUpstream', () => {
  test('creates a new owned deck copy from an upstream deck id', async () => {
    const { service, upsertCalls } = createImportTestService();

    const saved = await service.importFromUpstream('user-1', 'upstream-deck-1');

    expect(saved).not.toBeNull();
    expect(saved?.source).toBe('owned');
    expect(saved?.readOnly).toBe(false);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]?.id).toMatch(/^deck_/);
    expect(upsertCalls[0]?.id).not.toBe('upstream-deck-1');
    expect(upsertCalls[0]?.upstreamId).toBe('upstream-deck-1');
    expect(upsertCalls[0]?.importedFromId).toBe('upstream-deck-1');
    expect(upsertCalls[0]?.name).toBe('Imported Deck');
  });

  test('returns existing owned deck when upstream id was already imported', async () => {
    const existing: StoredDeckPayload = {
      ...importedPayload,
      id: 'deck_existing',
      upstreamId: 'upstream-deck-1',
    };
    const { service, upsertCalls } = createImportTestService([existing]);

    const saved = await service.importFromUpstream('user-1', 'upstream-deck-1');

    expect(saved?.id).toBe('deck_existing');
    expect(upsertCalls).toHaveLength(0);
  });
});
