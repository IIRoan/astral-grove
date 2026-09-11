import { describe, expect, test } from 'bun:test';
import {
  getCodeFromDeck,
  getDeckFromCode,
} from '@piltoverarchive/riftbound-deck-codes';
import { addCardToDeck, createEmptyDeck } from '@/lib/deck-card';
import {
  decodeDeckCode,
  deckStateToCodePayload,
  exportDeckCode,
  importDeckCode,
  looksLikeDeckCode,
  sortCodeCards,
  toDeckCodeCardCode,
} from '@/lib/deck-codes';
import type { DeckCard } from '@/lib/deck-types';
import golden from '@/lib/fixtures/riftbound-deck-codes-golden.json';

function card(variantNumber: string, overrides: Partial<DeckCard> = {}): DeckCard {
  const setCode = variantNumber.split('-')[0] ?? 'OGN';
  return {
    cardId: variantNumber,
    variantNumber,
    name: overrides.name ?? variantNumber,
    type: overrides.type ?? 'Unit',
    super: overrides.super ?? null,
    tags: overrides.tags ?? [],
    colors: overrides.colors ?? ['Fury'],
    energy: overrides.energy ?? 1,
    setCode,
    rarity: overrides.rarity ?? 'Common',
    variantType: overrides.variantType ?? 'Standard',
    isSignature: overrides.isSignature ?? false,
    ...overrides,
  };
}

function mockVariantResolver(cards: Record<string, DeckCard>) {
  return (variantNumber: string) => cards[variantNumber] ?? null;
}

describe('toDeckCodeCardCode', () => {
  test('keeps encoder-native codes', () => {
    expect(toDeckCodeCardCode('OGN-197')).toBe('OGN-197');
    expect(toDeckCodeCardCode('OGN-197b')).toBe('OGN-197b');
    expect(toDeckCodeCardCode('SFD-R02')).toBe('SFD-R02');
    expect(toDeckCodeCardCode('VEN-097')).toBe('VEN-097');
  });

  test('strips Nexus Night and foil printing suffixes', () => {
    expect(toDeckCodeCardCode('OGN-197b-Nexus')).toBe('OGN-197b');
    expect(toDeckCodeCardCode('OGN-128-Nexus')).toBe('OGN-128');
    expect(toDeckCodeCardCode('OGN-128-Nexus-Foil')).toBe('OGN-128');
    expect(toDeckCodeCardCode('OGN-001-Foil')).toBe('OGN-001');
  });
});

describe('looksLikeDeckCode', () => {
  test('accepts known golden codes', () => {
    for (const fixture of golden) {
      expect(looksLikeDeckCode(fixture.code)).toBe(true);
    }
  });

  test('rejects deck lists and short noise', () => {
    expect(looksLikeDeckCode('Legend:\n1 Jinx')).toBe(false);
    expect(looksLikeDeckCode('3 Flame Chompers (OGN-006)')).toBe(false);
    expect(looksLikeDeckCode('SHORT')).toBe(false);
    expect(looksLikeDeckCode('')).toBe(false);
    expect(looksLikeDeckCode('not a code!!!')).toBe(false);
  });
});

describe('Piltover Archive golden fixtures (1:1)', () => {
  for (const fixture of golden) {
    test(`${fixture.name} encodes to locked code`, () => {
      const code = getCodeFromDeck(
        fixture.input.mainDeck,
        fixture.input.sideboard,
        fixture.input.chosenChampion
      );
      expect(code).toBe(fixture.code);
    });

    test(`${fixture.name} decodes to locked shape`, () => {
      const decoded = getDeckFromCode(fixture.code);
      expect(sortCodeCards(decoded.mainDeck)).toEqual(
        sortCodeCards(fixture.decoded.mainDeck)
      );
      expect(sortCodeCards(decoded.sideboard)).toEqual(
        sortCodeCards(fixture.decoded.sideboard)
      );
      expect(decoded.chosenChampion).toBe(fixture.decoded.chosenChampion);
    });

    test(`${fixture.name} round-trips through library`, () => {
      const again = getCodeFromDeck(
        fixture.input.mainDeck,
        fixture.input.sideboard,
        fixture.input.chosenChampion
      );
      expect(getDeckFromCode(again)).toEqual(getDeckFromCode(fixture.code));
    });
  }
});

describe('deckStateToCodePayload / exportDeckCode', () => {
  test('merges legend, champion, main, runes, and battlefields into mainDeck', () => {
    let deck = createEmptyDeck('Test');
    deck = {
      ...deck,
      legend: card('OGN-280', {
        type: 'Legend',
        name: "Kai'Sa - Daughter of the Void",
      }),
      champion: card('OGN-103', {
        type: 'Unit',
        super: 'Champion',
        name: "Kai'Sa",
      }),
    };
    deck = addCardToDeck(deck, card('OGN-103', { type: 'Unit', super: 'Champion' }), {
      section: 'mainDeck',
      count: 2,
    });
    deck = addCardToDeck(deck, card('OGN-007', { type: 'Rune', name: 'Mind Rune' }), {
      section: 'runes',
      count: 7,
    });
    deck = addCardToDeck(deck, card('OGN-288', { type: 'Battlefield' }), {
      section: 'battlefields',
      count: 1,
    });
    deck = addCardToDeck(deck, card('OGN-004'), { section: 'mainDeck', count: 3 });
    deck = addCardToDeck(deck, card('OGN-022'), { section: 'sideboard', count: 2 });

    const payload = deckStateToCodePayload(deck);
    expect(sortCodeCards(payload.mainDeck)).toEqual(
      sortCodeCards([
        { cardCode: 'OGN-280', count: 1 },
        { cardCode: 'OGN-103', count: 3 },
        { cardCode: 'OGN-007', count: 7 },
        { cardCode: 'OGN-288', count: 1 },
        { cardCode: 'OGN-004', count: 3 },
      ])
    );
    expect(payload.sideboard).toEqual([{ cardCode: 'OGN-022', count: 2 }]);
    expect(payload.chosenChampion).toBe('OGN-103');
  });

  test('encodes Nexus Night champion printings without changing the deck', () => {
    let deck = createEmptyDeck('Nexus Teemo');
    deck = {
      ...deck,
      champion: card('OGN-197b-Nexus', {
        type: 'Unit',
        super: 'Champion',
        name: 'Teemo, Scout',
        setCode: 'OGN-NN',
      }),
    };
    deck = addCardToDeck(deck, card('VEN-097', { name: 'Spiderling' }), {
      section: 'mainDeck',
      count: 14,
    });
    deck = addCardToDeck(deck, card('OGN-197', { name: 'Teemo, Scout' }), {
      section: 'mainDeck',
      count: 2,
    });

    const payload = deckStateToCodePayload(deck);
    expect(payload.chosenChampion).toBe('OGN-197b');
    expect(payload.mainDeck).toEqual(
      expect.arrayContaining([
        { cardCode: 'OGN-197b', count: 1 },
        { cardCode: 'OGN-197', count: 2 },
        { cardCode: 'VEN-097', count: 14 },
      ])
    );
    expect(deck.champion?.variantNumber).toBe('OGN-197b-Nexus');
    expect(() => exportDeckCode(deck)).not.toThrow();
    expect(exportDeckCode(deck).length).toBeGreaterThan(16);
  });

  test("encodes the README Kai'Sa golden deck from DeckState", () => {
    const fixture = golden.find((g) => g.name.includes("Kai'Sa"));
    expect(fixture).toBeDefined();
    if (!fixture) return;

    let deck = createEmptyDeck("Kai'Sa");
    deck = {
      ...deck,
      champion: card(fixture.input.chosenChampion!, {
        type: 'Unit',
        super: 'Champion',
      }),
    };

    for (const entry of fixture.input.mainDeck) {
      if (entry.cardCode === fixture.input.chosenChampion) {
        // One copy already in champion slot; remaining go to main/runes/etc by type guess.
        const remaining = entry.count - 1;
        if (remaining > 0) {
          deck = addCardToDeck(
            deck,
            card(entry.cardCode, { type: 'Unit', super: 'Champion' }),
            {
              section: 'mainDeck',
              count: remaining,
            }
          );
        }
        continue;
      }
      // Heuristic sectioning for fixture rebuild — runes often have high counts of OGN-007/089.
      const isRuneLike =
        entry.count >= 5 &&
        (entry.cardCode === 'OGN-007' || entry.cardCode === 'OGN-089');
      const isBattlefield =
        entry.count === 1 && ['OGN-280', 'OGN-288', 'OGN-292'].includes(entry.cardCode);
      if (isRuneLike) {
        deck = addCardToDeck(deck, card(entry.cardCode, { type: 'Rune' }), {
          section: 'runes',
          count: entry.count,
        });
      } else if (isBattlefield) {
        deck = addCardToDeck(deck, card(entry.cardCode, { type: 'Battlefield' }), {
          section: 'battlefields',
          count: entry.count,
        });
      } else {
        deck = addCardToDeck(deck, card(entry.cardCode), {
          section: 'mainDeck',
          count: entry.count,
        });
      }
    }

    for (const entry of fixture.input.sideboard) {
      deck = addCardToDeck(deck, card(entry.cardCode), {
        section: 'sideboard',
        count: entry.count,
      });
    }

    expect(exportDeckCode(deck)).toBe(fixture.code);
  });

  test('omits chosenChampion when champion slot is empty', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, card('OGN-004'), { count: 3 });
    const payload = deckStateToCodePayload(deck);
    expect(payload.chosenChampion).toBeUndefined();
    expect(exportDeckCode(deck)).toBe(
      getCodeFromDeck([{ cardCode: 'OGN-004', count: 3 }], [])
    );
  });
});

describe('importDeckCode', () => {
  test('places chosen champion and remaining copies', async () => {
    const code = getCodeFromDeck(
      [
        { cardCode: 'OGN-103', count: 3 },
        { cardCode: 'OGN-004', count: 2 },
        { cardCode: 'OGN-007', count: 7 },
        { cardCode: 'OGN-288', count: 1 },
        { cardCode: 'OGN-280', count: 1 },
      ],
      [{ cardCode: 'OGN-022', count: 2 }],
      'OGN-103'
    );

    const cards: Record<string, DeckCard> = {
      'OGN-103': card('OGN-103', { type: 'Unit', super: 'Champion', name: "Kai'Sa" }),
      'OGN-004': card('OGN-004', { name: 'Spell' }),
      'OGN-007': card('OGN-007', { type: 'Rune', name: 'Mind Rune' }),
      'OGN-288': card('OGN-288', { type: 'Battlefield', name: 'Field' }),
      'OGN-280': card('OGN-280', { type: 'Legend', name: 'Legend' }),
      'OGN-022': card('OGN-022', { name: 'Side' }),
    };

    const { deck, unresolved } = await importDeckCode(code, mockVariantResolver(cards));
    expect(unresolved).toEqual([]);
    expect(deck.champion?.variantNumber).toBe('OGN-103');
    expect(deck.mainDeck.get("Kai'Sa")?.count).toBe(2);
    expect(deck.legend?.variantNumber).toBe('OGN-280');
    expect(deck.runes.get('Mind Rune')?.count).toBe(7);
    expect(deck.battlefields.get('Field')?.count).toBe(1);
    expect(deck.sideboard.get('Side')?.count).toBe(2);
    expect(deck.mainDeck.get('Spell')?.count).toBe(2);
  });

  test('reports unresolved card codes', async () => {
    const code = getCodeFromDeck([{ cardCode: 'OGN-004', count: 1 }], []);
    const { unresolved } = await importDeckCode(code, () => null);
    expect(unresolved).toEqual(['OGN-004']);
  });

  test('decodeDeckCode exposes chosenChampion', () => {
    const fixture = golden.find((g) => g.input.chosenChampion);
    expect(fixture).toBeDefined();
    if (!fixture) return;
    expect(decodeDeckCode(fixture.code).chosenChampion).toBe(
      fixture.input.chosenChampion
    );
  });
});

describe('version selection via library', () => {
  test('normal decks encode as v3', () => {
    const code = getCodeFromDeck([{ cardCode: 'OGN-004', count: 3 }], []);
    const bytes = Buffer.from(
      // Smoke: version 3 encodes as base32 prefix CM… (first nibble of first char).
      (() => {
        return code;
      })()
    );
    expect(bytes.length).toBeGreaterThan(0);
    // Format 1 / version 3 → first byte 0x13 → base32 starts with CM…
    expect(code.startsWith('CM')).toBe(true);
  });

  test('R-prefixed runes encode as v4', () => {
    const code = getCodeFromDeck([{ cardCode: 'SFD-R02', count: 3 }], []);
    expect(code.startsWith('CQ')).toBe(true);
  });

  test('high copy counts encode as v5', () => {
    const code = getCodeFromDeck([{ cardCode: 'VEN-097', count: 40 }], []);
    expect(code.startsWith('CU')).toBe(true);
  });
});
