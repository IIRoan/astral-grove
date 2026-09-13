import type { DecksListQuery, DeckFormat } from '@riftbound/contracts';
import { refreshDeckLegality } from '@/lib/enrich-deck-ban-dates';
import {
  cloneDeck,
  createEmptyDeck,
  deserializeDeck,
  serializeDeck,
} from '@/lib/deck-card';
import { deckVersionSaveKey, isSaveKeyForDeck } from '@/lib/deck-version';
import type { DeckState } from '@/lib/deck-types';
import { logActionFailure } from '@/lib/logger';
import {
  fetchRemoteDeck,
  fetchRemoteDecks,
  remoteDeleteDeck,
  remoteImportDeck,
  remoteUpsertDeck,
  remoteUpsertDeckVersion,
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
  const saved = await remoteUpsertDeck(serializeDeck(deck));
  return deserializeDeck(saved);
}

export async function saveDeckToAccount(deck: DeckState): Promise<DeckState> {
  const payload = serializeDeck(deck);
  const saved = deck.versionId
    ? await remoteUpsertDeckVersion(deck.id, deck.versionId, payload)
    : await remoteUpsertDeck(payload);
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
  const saved = await remoteUpsertDeck(serializeDeck(copy));
  return deserializeDeck(saved);
}

export async function deleteDeck(id: string): Promise<void> {
  await remoteDeleteDeck(id);
}

export type DeckSaveState = 'idle' | 'saving' | 'saved' | 'error';

export type DeckSaveStatus = {
  state: DeckSaveState;
  updatedAt: number | null;
};

const IDLE_SAVE_STATUS: DeckSaveStatus = { state: 'idle', updatedAt: null };

const remoteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingRemoteDecks = new Map<string, DeckState>();
const inFlightSaves = new Map<string, Promise<DeckState | null>>();
const saveStatusByKey = new Map<string, DeckSaveStatus>();
const saveStatusListeners = new Set<() => void>();

function emitSaveStatus(): void {
  for (const listener of saveStatusListeners) listener();
}

function setSaveStatus(key: string, status: DeckSaveStatus): void {
  saveStatusByKey.set(key, status);
  emitSaveStatus();
}

export function subscribeDeckSaveStatus(onStoreChange: () => void): () => void {
  saveStatusListeners.add(onStoreChange);
  return () => {
    saveStatusListeners.delete(onStoreChange);
  };
}

export function getDeckSaveStatus(deckId: string, versionId?: string): DeckSaveStatus {
  return saveStatusByKey.get(deckVersionSaveKey(deckId, versionId)) ?? IDLE_SAVE_STATUS;
}

function saveKeysForDeck(deckId: string): string[] {
  const keys = new Set<string>();
  for (const key of pendingRemoteDecks.keys()) {
    if (isSaveKeyForDeck(key, deckId)) keys.add(key);
  }
  for (const key of remoteSaveTimers.keys()) {
    if (isSaveKeyForDeck(key, deckId)) keys.add(key);
  }
  for (const key of inFlightSaves.keys()) {
    if (isSaveKeyForDeck(key, deckId)) keys.add(key);
  }
  return [...keys];
}

export function hasPendingDeckSave(deckId: string, versionId?: string): boolean {
  if (versionId) {
    const key = deckVersionSaveKey(deckId, versionId);
    return (
      pendingRemoteDecks.has(key) || remoteSaveTimers.has(key) || inFlightSaves.has(key)
    );
  }
  return saveKeysForDeck(deckId).length > 0;
}

function keyForDeck(deck: DeckState): string {
  return deckVersionSaveKey(deck.id, deck.versionId);
}

export function queueRemoteDeckSave(deck: DeckState): void {
  if (deck.readOnly) return;
  pendingRemoteDecks.set(keyForDeck(deck), deck);
}

export function scheduleRemoteDeckSave(
  deck: DeckState,
  debounceMs = DECK_AUTO_SAVE_MS
): void {
  if (deck.readOnly) return;
  queueRemoteDeckSave(deck);
  const key = keyForDeck(deck);
  const existing = remoteSaveTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    remoteSaveTimers.delete(key);
    void flushSaveKey(key);
  }, debounceMs);

  remoteSaveTimers.set(key, timer);
}

async function flushSaveKey(key: string): Promise<DeckState | null> {
  const timer = remoteSaveTimers.get(key);
  if (timer) clearTimeout(timer);
  remoteSaveTimers.delete(key);

  const existing = inFlightSaves.get(key);
  if (existing) {
    return existing.then(async (saved) => {
      if (!pendingRemoteDecks.has(key)) return saved;
      return flushSaveKey(key);
    });
  }

  const pending = pendingRemoteDecks.get(key);
  if (!pending) return null;
  if (pending.readOnly) {
    pendingRemoteDecks.delete(key);
    return null;
  }

  pendingRemoteDecks.delete(key);
  setSaveStatus(key, { state: 'saving', updatedAt: Date.now() });

  const savePromise = (async (): Promise<DeckState | null> => {
    let current = pending;
    for (; ;) {
      const saved = await saveDeckToAccount(current);
      const newer = pendingRemoteDecks.get(key);
      if (!newer || newer.updatedAt <= saved.updatedAt) {
        setSaveStatus(key, { state: 'saved', updatedAt: Date.now() });
        return saved;
      }
      pendingRemoteDecks.delete(key);
      current = newer;
    }
  })()
    .catch((error) => {
      if (isRemoteDeckReadOnlyError(error)) {
        pendingRemoteDecks.delete(key);
        setSaveStatus(key, { state: 'idle', updatedAt: null });
        return null;
      }
      logActionFailure('decks.save', error, { deckId: pending.id, key });
      queueRemoteDeckSave(pending);
      setSaveStatus(key, { state: 'error', updatedAt: Date.now() });
      throw error;
    })
    .finally(() => {
      inFlightSaves.delete(key);
    });

  inFlightSaves.set(key, savePromise);
  return savePromise;
}

/** Flush pending changes and wait for the API save to finish. */
export async function flushRemoteDeckSave(
  deckId: string,
  versionId?: string
): Promise<DeckState | null> {
  if (versionId) return flushSaveKey(deckVersionSaveKey(deckId, versionId));
  let last: DeckState | null = null;
  for (const key of saveKeysForDeck(deckId)) {
    last = (await flushSaveKey(key)) ?? last;
  }
  return last;
}

export async function flushEditorDeckSave(deck: DeckState): Promise<DeckState | null> {
  if (deck.readOnly) return null;
  queueRemoteDeckSave(deck);
  return flushRemoteDeckSave(deck.id, deck.versionId);
}
