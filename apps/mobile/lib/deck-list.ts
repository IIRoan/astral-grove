import type { DeckFormat } from '@riftbound/contracts';
import { matchesSearchHaystack } from '@riftbound/contracts';
import type { DeckState } from '@/lib/deck-types';

export type OwnedDeckFormatFilter = 'all' | DeckFormat;
export type OwnedDeckSort = 'edited' | 'created' | 'name';
export type DeckListLayout = 'list' | 'grid';

export function filterDecksByQuery(decks: DeckState[], query: string): DeckState[] {
  const needle = query.trim();
  if (!needle) return decks;

  return decks.filter((deck) =>
    matchesSearchHaystack(
      [
        deck.name,
        deck.description,
        deck.legend?.name ?? '',
        deck.champion?.name ?? '',
      ].join(' '),
      needle
    )
  );
}

export function filterDecksByFormat(
  decks: DeckState[],
  format: OwnedDeckFormatFilter
): DeckState[] {
  if (format === 'all') return decks;
  return decks.filter((deck) => deck.format === format);
}

export function countDecksByFormat(decks: readonly DeckState[]): {
  all: number;
  constructed: number;
  'pre-rift': number;
} {
  let constructed = 0;
  let preRift = 0;
  for (const deck of decks) {
    if (deck.format === 'pre-rift') preRift += 1;
    else constructed += 1;
  }
  return { all: decks.length, constructed, 'pre-rift': preRift };
}

export function sortOwnedDecks(decks: DeckState[], sort: OwnedDeckSort): DeckState[] {
  return [...decks].sort((left, right) => {
    if (sort === 'name') {
      return left.name.localeCompare(right.name) || right.updatedAt - left.updatedAt;
    }
    if (sort === 'created') {
      return right.createdAt - left.createdAt || left.name.localeCompare(right.name);
    }
    return right.updatedAt - left.updatedAt || left.name.localeCompare(right.name);
  });
}
