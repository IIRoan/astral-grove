import { describe, expect, test } from 'bun:test';
import type { DeckCard, DeckEntry } from '@/lib/deck-types';
import {
  DECK_GRID_COLUMNS,
  buildBattlefieldSlots,
  buildDeckGridRows,
  countRunesForDomain,
  getLegendRuneDomains,
  type DeckGridCell,
} from '@/lib/deck-builder';

function mockCard(name: string, colors: string[] = ['Fury']): DeckCard {
  return {
    cardId: `id-${name}`,
    variantNumber: 'OGN-001',
    name,
    type: 'Unit',
    super: null,
    tags: [],
    colors,
    energy: 2,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
  };
}

function mockEntry(card: DeckCard, count: number): DeckEntry {
  return { card, count };
}

describe('getLegendRuneDomains', () => {
  test('returns the first two legend colors', () => {
    const legend = mockCard('Jinx', ['Fury', 'Chaos']);
    expect(getLegendRuneDomains(legend)).toEqual(['Fury', 'Chaos']);
  });

  test('duplicates single-color legends for both rune slots', () => {
    const legend = mockCard('Solo', ['Mind']);
    expect(getLegendRuneDomains(legend)).toEqual(['Mind', 'Mind']);
  });
});

describe('countRunesForDomain', () => {
  test('sums rune copies matching domain color', () => {
    const runes = new Map<string, DeckEntry>([
      [
        mockCard('Fury Rune', ['Fury']).name,
        mockEntry(mockCard('Fury Rune', ['Fury']), 7),
      ],
      [
        mockCard('Chaos Rune', ['Chaos']).name,
        mockEntry(mockCard('Chaos Rune', ['Chaos']), 5),
      ],
    ]);

    expect(countRunesForDomain(runes, 'Fury')).toBe(7);
    expect(countRunesForDomain(runes, 'Chaos')).toBe(5);
  });
});

describe('buildBattlefieldSlots', () => {
  test('always returns three slots in stable order', () => {
    const battlefields = new Map<string, DeckEntry>([
      ['Zaun Warrens', mockEntry(mockCard('Zaun Warrens', ['Chaos']), 1)],
    ]);

    const slots = buildBattlefieldSlots(battlefields);
    expect(slots).toHaveLength(3);
    expect(slots[0]?.card.name).toBe('Zaun Warrens');
    expect(slots[1]).toBeNull();
    expect(slots[2]).toBeNull();
  });

  test('expands multiple copies of the same battlefield into separate slots', () => {
    const battlefields = new Map<string, DeckEntry>([
      ['Zaun Warrens', mockEntry(mockCard('Zaun Warrens', ['Chaos']), 3)],
    ]);

    const slots = buildBattlefieldSlots(battlefields);
    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => slot?.card.name === 'Zaun Warrens')).toBe(true);
  });
});

describe('buildDeckGridRows', () => {
  test('pads incomplete final row and appends add placeholder', () => {
    const entries = [
      mockEntry(mockCard('A'), 1),
      mockEntry(mockCard('B'), 2),
      mockEntry(mockCard('C'), 1),
      mockEntry(mockCard('D'), 1),
    ];

    const rows = buildDeckGridRows(entries, {
      columns: DECK_GRID_COLUMNS,
      includeAdd: true,
    });
    const flat: DeckGridCell[] = rows.flat();

    expect(rows).toHaveLength(2);
    expect(flat.filter((cell) => cell.kind === 'card')).toHaveLength(4);
    expect(flat.at(-1)).toEqual({ kind: 'add' });
  });

  test('shows only add placeholder when empty', () => {
    const rows = buildDeckGridRows([], {
      columns: DECK_GRID_COLUMNS,
      includeAdd: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([{ kind: 'add' }]);
  });
});
