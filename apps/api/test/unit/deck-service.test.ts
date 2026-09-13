import { describe, expect, test } from 'bun:test';
import type { StoredDeckPayload } from '@riftbound/contracts';
import {
  DeckLastVersionError,
  DeckReadOnlyError,
  DeckService,
  DeckVersionLimitError,
  deckPayloadForPersist,
  mergeActivePayload,
  payloadForNewVersion,
} from '../../src/services/deck-service.js';
import type { Database } from '../../src/db/client.js';

function ownedPayload(
  id: string,
  name: string,
  extras?: Partial<StoredDeckPayload>
): StoredDeckPayload {
  const now = Date.now();
  return {
    id,
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    legend: null,
    champion: null,
    mainDeck: [],
    runes: [],
    battlefields: [],
    sideboard: [],
    ...extras,
  };
}

function createListMockDb(payloads: StoredDeckPayload[]): Database {
  const rows = payloads.map((payload) => ({
    payload,
    activeVersionId: `dver_${payload.id}`,
    versionName: 'Current',
  }));
  return {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: async () => rows,
          }),
        }),
      }),
    }),
    query: {
      userDecks: {
        findFirst: async () => null,
      },
    },
  } as unknown as Database;
}

describe('DeckReadOnlyError', () => {
  test('has stable name and message for imported deck guards', () => {
    const error = new DeckReadOnlyError();
    expect(error.name).toBe('DeckReadOnlyError');
    expect(error.message).toBe('Imported Piltover Archive decks are read-only');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('DeckService.listForUser', () => {
  test('filters owned decks by name, description, legend, and champion', async () => {
    const service = new DeckService(
      createListMockDb([
        ownedPayload('deck_a', 'Jinx Aggro', {
          legend: { variantNumber: 'OGN-001', name: 'Jinx Rebel', quantity: 1 },
        }),
        ownedPayload('deck_b', 'Control', {
          champion: { variantNumber: 'OGN-010', name: 'Viktor Herald', quantity: 1 },
        }),
        ownedPayload('deck_c', 'Burn', { description: 'fast jinx list' }),
      ])
    );

    const byLegend = await service.listForUser('user-1', {
      q: 'jinx',
      source: 'owned',
    });
    expect(byLegend.items.map((deck) => deck.id).sort()).toEqual(['deck_a', 'deck_c']);

    const byChampion = await service.listForUser('user-1', {
      q: 'viktor',
      source: 'owned',
    });
    expect(byChampion.items.map((deck) => deck.id)).toEqual(['deck_b']);

    const emptyQuery = await service.listForUser('user-1', {
      q: '   ',
      source: 'owned',
    });
    expect(emptyQuery.items).toHaveLength(3);
  });

  test('includes active version id and name on owned list items', async () => {
    const service = new DeckService(
      createListMockDb([ownedPayload('deck_owned', 'Mine')])
    );
    const result = await service.listForUser('user-1', { source: 'owned' });
    expect(result.items[0]).toMatchObject({
      id: 'deck_owned',
      versionId: 'dver_deck_owned',
      versionName: 'Current',
    });
    expect(result.items[0]?.versions).toBeUndefined();
  });

  test('marks owned decks as editable', async () => {
    const service = new DeckService(
      createListMockDb([ownedPayload('deck_owned', 'Mine')])
    );
    const result = await service.listForUser('user-1', { source: 'owned' });
    expect(result.items[0]).toMatchObject({
      id: 'deck_owned',
      source: 'owned',
      readOnly: false,
    });
  });

  test('returns empty imported section when upstream client is unavailable', async () => {
    const service = new DeckService(
      createListMockDb([ownedPayload('deck_owned', 'Mine')])
    );
    const result = await service.listForUser('user-1', { source: 'all' });
    expect(result.owned).toBe(1);
    expect(result.imported).toBe(0);
    expect(result.pagination).toBeUndefined();
  });
});

describe('deckPayloadForPersist', () => {
  test('drops client-supplied upstreamId on new decks', () => {
    const incoming = ownedPayload('attacker-id', 'Hijack', {
      upstreamId: 'pa-community-deck',
    });
    const persisted = deckPayloadForPersist(incoming, null);
    expect(persisted.upstreamId).toBeUndefined();
    expect(persisted.id).toBe('attacker-id');
  });

  test('keeps the stored upstreamId and ignores a client replacement', () => {
    const stored = ownedPayload('deck_owned', 'Mine', { upstreamId: 'pa-owned-123' });
    const incoming = ownedPayload('deck_owned', 'Mine', {
      upstreamId: 'pa-someone-else',
    });
    const persisted = deckPayloadForPersist(incoming, stored);
    expect(persisted.upstreamId).toBe('pa-owned-123');
  });

  test('drops client-supplied importedFromId', () => {
    const incoming = ownedPayload('deck_owned', 'Mine', {
      importedFromId: 'pa-community',
    });
    const persisted = deckPayloadForPersist(incoming, null);
    expect(persisted.importedFromId).toBeUndefined();
  });

  test('keeps trusted import provenance', () => {
    const incoming = ownedPayload('deck_copy', 'Copy', {
      upstreamId: 'pa-community',
      importedFromId: 'pa-community',
    });
    const persisted = deckPayloadForPersist(incoming, null, {
      trustIncomingProvenance: true,
    });
    expect(persisted.upstreamId).toBe('pa-community');
    expect(persisted.importedFromId).toBe('pa-community');
  });
});

describe('mergeActivePayload', () => {
  test('keeps family name, description, and provenance when switching versions', () => {
    const family = ownedPayload('deck_owned', 'Annie Aggro', {
      description: 'family notes',
      upstreamId: 'pa-owned-123',
      importedFromId: 'pa-community',
    });
    const version = ownedPayload('deck_owned', 'Old name', {
      description: 'version notes',
      mainDeck: [
        {
          card: {
            cardId: 'c1',
            variantNumber: 'OGN-001',
            name: 'Sparklefly',
            type: 'Unit',
            super: null,
            tags: [],
            colors: ['orange'],
            energy: 1,
            setCode: 'OGN',
            rarity: 'common',
            variantType: 'standard',
            isSignature: false,
          },
          count: 3,
        },
      ],
    });
    const merged = mergeActivePayload(family, version);
    expect(merged.id).toBe('deck_owned');
    expect(merged.name).toBe('Annie Aggro');
    expect(merged.description).toBe('family notes');
    expect(merged.upstreamId).toBe('pa-owned-123');
    expect(merged.importedFromId).toBe('pa-community');
    expect(merged.mainDeck).toHaveLength(1);
  });
});

describe('payloadForNewVersion', () => {
  test('keeps family name and provenance when the source version is stale', () => {
    const family = ownedPayload('deck_owned', 'Annie Midrange', {
      description: 'current notes',
      upstreamId: 'pa-owned-123',
    });
    const source = ownedPayload('deck_owned', 'Annie Aggro', {
      description: 'old notes',
      mainDeck: [
        {
          card: {
            cardId: 'c1',
            variantNumber: 'OGN-001',
            name: 'Sparklefly',
            type: 'Unit',
            super: null,
            tags: [],
            colors: ['orange'],
            energy: 1,
            setCode: 'OGN',
            rarity: 'common',
            variantType: 'standard',
            isSignature: false,
          },
          count: 3,
        },
      ],
    });
    const copy = payloadForNewVersion(family, source, 99);
    expect(copy.name).toBe('Annie Midrange');
    expect(copy.description).toBe('current notes');
    expect(copy.upstreamId).toBe('pa-owned-123');
    expect(copy.updatedAt).toBe(99);
    expect(copy.mainDeck).toHaveLength(1);
  });
});

describe('deck version errors', () => {
  test('last-version and limit errors have stable names', () => {
    expect(new DeckLastVersionError().name).toBe('DeckLastVersionError');
    expect(new DeckVersionLimitError().name).toBe('DeckVersionLimitError');
  });
});
