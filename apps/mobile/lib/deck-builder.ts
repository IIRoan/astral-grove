import { legendRuneDomains as contractLegendRuneDomains } from '@riftbound/contracts';
import type { DeckCard, DeckEntry, DeckState } from '@/lib/deck-types';

/** Default column count when responsive layout is unavailable. */
export const DECK_GRID_COLUMNS = 3;

export type DeckGridCardCell = {
  kind: 'card';
  name: string;
  entry: DeckEntry;
};

export type DeckGridAddCell = {
  kind: 'add';
};

export type DeckGridEmptyCell = {
  kind: 'empty';
};

export type DeckGridCell = DeckGridCardCell | DeckGridAddCell | DeckGridEmptyCell;

export type BattlefieldSlot = DeckEntry | null;

export function getLegendRuneDomains(
  legend: Pick<DeckCard, 'colors'>
): [string, string] {
  return contractLegendRuneDomains(legend);
}

/** Domains shown in the rune panel — up to 3 for Pre-Rift, legend pair for Constructed. */
export function getDeckRuneDomains(
  deck: Pick<
    DeckState,
    | 'format'
    | 'legend'
    | 'runes'
    | 'mainDeck'
    | 'champion'
    | 'battlefields'
    | 'sideboard'
  >
): string[] {
  const domains: string[] = [];
  const seen = new Set<string>();
  const isPreRift = deck.format === 'pre-rift';
  const max = isPreRift ? Number.POSITIVE_INFINITY : 2;

  const addFrom = (colors: string[]) => {
    for (const color of colors) {
      const trimmed = color.trim();
      if (!trimmed || seen.has(trimmed) || domains.length >= max) continue;
      domains.push(trimmed);
      seen.add(trimmed);
    }
  };

  if (deck.legend) {
    const [first, second] = getLegendRuneDomains(deck.legend);
    addFrom(first === second ? [first] : [first, second]);
  }

  if (isPreRift) {
    if (deck.champion) addFrom(deck.champion.colors);
    for (const [, entry] of deck.mainDeck) addFrom(entry.card.colors);
    for (const [, entry] of deck.runes) addFrom(entry.card.colors);
    for (const [, entry] of deck.battlefields) addFrom(entry.card.colors);
    for (const [, entry] of deck.sideboard) addFrom(entry.card.colors);
  }

  return domains;
}

export function countRunesForDomain(
  runes: ReadonlyMap<string, DeckEntry>,
  domain: string
): number {
  let total = 0;
  for (const [, entry] of runes) {
    if (entry.card.colors.includes(domain)) {
      total += entry.count;
    }
  }
  return total;
}

export function buildBattlefieldSlots(
  battlefields: ReadonlyMap<string, DeckEntry>
): BattlefieldSlot[] {
  const filled: BattlefieldSlot[] = [];
  for (const entry of battlefields.values()) {
    for (let copy = 0; copy < entry.count; copy += 1) {
      if (filled.length >= 3) break;
      filled.push(entry);
    }
    if (filled.length >= 3) break;
  }
  const slots: BattlefieldSlot[] = [...filled];
  while (slots.length < 3) {
    slots.push(null);
  }
  return slots;
}

export function buildDeckGridRows(
  entries: DeckEntry[],
  options: { columns?: number; includeAdd?: boolean } = {}
): DeckGridCell[][] {
  const columns = options.columns ?? DECK_GRID_COLUMNS;
  const includeAdd = options.includeAdd ?? true;

  const cells: DeckGridCell[] = entries.map((entry) => ({
    kind: 'card',
    name: entry.card.name,
    entry,
  }));

  if (includeAdd) {
    cells.push({ kind: 'add' });
  }

  const rows: DeckGridCell[][] = [];
  for (let index = 0; index < cells.length; index += columns) {
    const row = cells.slice(index, index + columns);
    while (row.length < columns && index + columns >= cells.length && !includeAdd) {
      row.push({ kind: 'empty' });
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    rows.push(includeAdd ? [{ kind: 'add' }] : [{ kind: 'empty' }]);
  }

  return rows;
}

export function deckGridCellKey(cell: DeckGridCell): string {
  switch (cell.kind) {
    case 'card':
      return cell.name;
    case 'add':
      return 'add';
    case 'empty':
      return 'empty';
  }
}

export function deckGridRowKey(row: DeckGridCell[]): string {
  return row.map(deckGridCellKey).join('|');
}

export function totalRuneCount(runes: ReadonlyMap<string, DeckEntry>): number {
  let total = 0;
  for (const [, entry] of runes) {
    total += entry.count;
  }
  return total;
}
