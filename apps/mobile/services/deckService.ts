import type { DecksListQuery, DeckFormat } from '@riftbound/contracts';
import { refreshDeckLegality } from '@/lib/enrich-deck-ban-dates';
import {
  cloneDeck,
  createEmptyDeck,
  deserializeDeck,
  serializeDeck,
} from '@/lib/deck-card';
import type { DeckState } from '@/lib/deck-types';
import { logActionFailure } from '@/lib/logger';
import {
  fetchRemoteDeck,
  fetchRemoteDecks,
  remoteDeleteDeck,
  remoteImportDeck,
  remoteUpsertDeck,
  isRemoteDeckReadOnlyError,
} from '@/services/remoteDeckService';

export const DECK_AUTO_SAVE_MS = 800;

export async function listDecks(
  options?: Partial<DecksListQuery>
): Promise<DeckState[]> {
  const remote = await fetchRemoteDecks(options);
  return remote.data.map(deserializeDeck);
}

export async function listDecksPage(options?: Partial<DecksListQuery>): Promise<{
  data: DeckState[];
  pagination?: Awaited<ReturnType<typeof fetchRemoteDecks>>['pagination'];
}> {
  const remote = await fetchRemoteDecks(options);
  return {
    data: remote.data.map(deserializeDeck),
    pagination: remote.pagination,
  };
}

export async function getDeck(id: string): Promise<DeckState | null> {
  const remote = await fetchRemoteDeck(id);
  if (!remote) return null;
  const deck = deserializeDeck(remote);
  return refreshDeckLegality(deck);
}

export async function createDeck(
  name = 'New Deck',
  description = '',
  format: DeckFormat = 'constructed'
): Promise<DeckState> {
  const deck = createEmptyDeck(name, description, format);
  await remoteUpsertDeck(serializeDeck(deck));
  return deck;
}

export async function saveDeckToAccount(deck: DeckState): Promise<DeckState> {
  const saved = await remoteUpsertDeck(serializeDeck(deck));
  return deserializeDeck(saved);
}

export async function importDeckToAccount(
  sourceDeckId: string,
  format: DeckFormat = 'constructed'
): Promise<DeckState> {
  const saved = await remoteImportDeck(sourceDeckId);
  const deck = deserializeDeck(saved);
  if (deck.format === format) return deck;
  return saveDeckToAccount({ ...deck, format, updatedAt: Date.now() });
}

export async function duplicateDeck(source: DeckState): Promise<DeckState> {
  const copy = cloneDeck(source);
  await remoteUpsertDeck(serializeDeck(copy));
  return copy;
}

export async function deleteDeck(id: string): Promise<void> {
  await remoteDeleteDeck(id);
}

const remoteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingRemoteDecks = new Map<string, DeckState>();
const inFlightSaves = new Map<string, Promise<DeckState | null>>();

export function hasPendingDeckSave(deckId: string): boolean {
  return (
    pendingRemoteDecks.has(deckId) ||
    remoteSaveTimers.has(deckId) ||
    inFlightSaves.has(deckId)
  );
}

export function queueRemoteDeckSave(deck: DeckState): void {
  if (deck.readOnly) return;
  pendingRemoteDecks.set(deck.id, deck);
}

export function scheduleRemoteDeckSave(
  deck: DeckState,
  debounceMs = DECK_AUTO_SAVE_MS
): void {
  if (deck.readOnly) return;
  queueRemoteDeckSave(deck);
  const existing = remoteSaveTimers.get(deck.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    remoteSaveTimers.delete(deck.id);
    void flushRemoteDeckSave(deck.id);
  }, debounceMs);

  remoteSaveTimers.set(deck.id, timer);
}

/** Flush pending changes and wait for the API save to finish. */
export async function flushRemoteDeckSave(deckId: string): Promise<DeckState | null> {
  const timer = remoteSaveTimers.get(deckId);
  if (timer) clearTimeout(timer);
  remoteSaveTimers.delete(deckId);

  const existing = inFlightSaves.get(deckId);
  if (existing) {
    return existing.then(async (saved) => {
      if (!pendingRemoteDecks.has(deckId)) return saved;
      return flushRemoteDeckSave(deckId);
    });
  }

  const pending = pendingRemoteDecks.get(deckId);
  if (!pending) return null;
  if (pending.readOnly) {
    pendingRemoteDecks.delete(deckId);
    return null;
  }

  pendingRemoteDecks.delete(deckId);

  const savePromise = (async (): Promise<DeckState | null> => {
    let current = pending;
    for (;;) {
      const saved = await saveDeckToAccount(current);
      const newer = pendingRemoteDecks.get(deckId);
      if (!newer || newer.updatedAt <= saved.updatedAt) {
        return saved;
      }
      pendingRemoteDecks.delete(deckId);
      current = newer;
    }
  })()
    .catch((error) => {
      if (isRemoteDeckReadOnlyError(error)) {
        pendingRemoteDecks.delete(deckId);
        return null;
      }
      logActionFailure('decks.save', error, { deckId });
      queueRemoteDeckSave(pending);
      throw error;
    })
    .finally(() => {
      inFlightSaves.delete(deckId);
    });

  inFlightSaves.set(deckId, savePromise);
  return savePromise;
}
