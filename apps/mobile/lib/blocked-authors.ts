import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const STORAGE_KEY = 'blocked-deck-authors';
const StoredAuthors = z.array(z.string());

let blocked: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function normalizeAuthor(name: string): string {
  return name.trim().toLowerCase();
}

/** Community decks whose author the viewer has not blocked. */
export function withoutBlockedAuthors<T extends { authorName?: string | null }>(
  decks: readonly T[],
  authors: ReadonlySet<string>
): T[] {
  if (authors.size === 0) return [...decks];
  return decks.filter(
    (deck) => !deck.authorName || !authors.has(normalizeAuthor(deck.authorName))
  );
}

function publish(next: ReadonlySet<string>) {
  blocked = next;
  for (const listener of listeners) listener();
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
}

void AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    const parsed = StoredAuthors.safeParse(raw ? JSON.parse(raw) : []);
    if (parsed.success && parsed.data.length > 0) {
      blocked = new Set([...blocked, ...parsed.data]);
      for (const listener of listeners) listener();
    }
  })
  .catch(() => {});

export function blockAuthor(name: string) {
  publish(new Set([...blocked, normalizeAuthor(name)]));
}

export function unblockAuthor(name: string) {
  const next = new Set(blocked);
  next.delete(normalizeAuthor(name));
  publish(next);
}

export function useBlockedAuthors(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => blocked,
    () => blocked
  );
}
