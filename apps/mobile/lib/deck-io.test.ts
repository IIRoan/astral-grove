import { describe, expect, test } from 'bun:test';
import { addCardToDeck, createEmptyDeck } from '@/lib/deck-card';
import {
  detectDeckImportFormat,
  exportPiltoverArchive,
  importPiltoverArchive,
} from '@/lib/deck-io';
import type { DeckCard } from '@/lib/deck-types';

const SAMPLE = `Legend:
1 Jinx, Loose Cannon

Champion:
1 Jinx, Demolitionist

MainDeck:
3 Flame Chompers

Battlefields:
1 Zaun Warrens

Runes:
12 Fury Rune`;

function mockResolver(cards: Record<string, DeckCard>) {
  return (name: string) => cards[name] ?? null;
}

describe('deck-io', () => {
  test('detects PiltoverArchive format', () => {
    expect(detectDeckImportFormat(SAMPLE)).toBe('piltoverarchive');
    expect(detectDeckImportFormat('3 Flame Chompers (OGN-006)')).toBe('flat');
  });

  test('detects Piltover Archive deck codes', () => {
    expect(
      detectDeckImportFormat(
        'CMAAAAAAAAAQCAAAA4AACAIAABMQAAILAAAAICIMDMOVOX3AM5UHIAIDAAACO6XYAEAQKAAABX3QDGACUABKIAQAAEBQAAAWDBOQCAQAABMHEAIAABTQ'
      )
    ).toBe('deckcode');
  });

  test('exports PiltoverArchive sections', () => {
    let deck = createEmptyDeck('Budget Jinx');
    deck = addCardToDeck(
      deck,
      {
        cardId: '1',
        variantNumber: 'OGN-251',
        name: 'Jinx - Loose Cannon',
        type: 'Legend',
        super: null,
        tags: ['Jinx'],
        colors: ['Fury', 'Chaos'],
        energy: 0,
        setCode: 'OGN',
        rarity: 'Rare',
        variantType: 'Standard',
        isSignature: false,
      },
      { section: 'legend' }
    );

    const text = exportPiltoverArchive(deck);
    expect(text).toContain('Legend:\n1 Jinx, Loose Cannon');
  });

  test('imports PiltoverArchive deck text', async () => {
    const cards: Record<string, DeckCard> = {
      'Jinx - Loose Cannon': {
        cardId: '1',
        variantNumber: 'OGN-251',
        name: 'Jinx - Loose Cannon',
        type: 'Legend',
        super: null,
        tags: ['Jinx'],
        colors: ['Fury', 'Chaos'],
        energy: 0,
        setCode: 'OGN',
        rarity: 'Rare',
        variantType: 'Standard',
        isSignature: false,
      },
      'Jinx - Demolitionist': {
        cardId: '2',
        variantNumber: 'OGN-030',
        name: 'Jinx - Demolitionist',
        type: 'Unit',
        super: 'Champion',
        tags: ['Jinx'],
        colors: ['Fury'],
        energy: 3,
        setCode: 'OGN',
        rarity: 'Rare',
        variantType: 'Standard',
        isSignature: false,
      },
      'Flame Chompers': {
        cardId: '3',
        variantNumber: 'OGN-006',
        name: 'Flame Chompers',
        type: 'Unit',
        super: null,
        tags: [],
        colors: ['Fury'],
        energy: 2,
        setCode: 'OGN',
        rarity: 'Common',
        variantType: 'Standard',
        isSignature: false,
      },
      'Zaun Warrens': {
        cardId: '4',
        variantNumber: 'OGN-300',
        name: 'Zaun Warrens',
        type: 'Battlefield',
        super: null,
        tags: [],
        colors: ['Chaos'],
        energy: 0,
        setCode: 'OGN',
        rarity: 'Uncommon',
        variantType: 'Standard',
        isSignature: false,
      },
      'Fury Rune': {
        cardId: '5',
        variantNumber: 'OGN-001',
        name: 'Fury Rune',
        type: 'Rune',
        super: null,
        tags: [],
        colors: ['Fury'],
        energy: 0,
        setCode: 'OGN',
        rarity: 'Common',
        variantType: 'Standard',
        isSignature: false,
      },
    };

    const { deck, unresolved } = await importPiltoverArchive(
      SAMPLE,
      mockResolver(cards)
    );
    expect(unresolved).toEqual([]);
    expect(deck.legend?.name).toBe('Jinx - Loose Cannon');
    expect(deck.champion?.name).toBe('Jinx - Demolitionist');
    expect(deck.mainDeck.get('Flame Chompers')?.count).toBe(3);
    expect(deck.battlefields.get('Zaun Warrens')?.count).toBe(1);
    expect(deck.runes.get('Fury Rune')?.count).toBe(12);
  });
});
