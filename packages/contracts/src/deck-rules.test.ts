import { describe, expect, test } from 'bun:test';
import {
  RIFTBOUND_DECK_RULES,
  RIFTBOUND_PRE_RIFT_DECK_RULES,
  DeckRulesResponse,
  DeckValidateInput,
  domainIdentityMatch,
  validateRiftboundDeck,
} from './deck-rules.js';

const jinxLegend = {
  cardId: 'legend-1',
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
};

const jinxChampion = {
  cardId: 'champ-1',
  variantNumber: 'OGN-100',
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
};

const furyRune = {
  cardId: 'rune-1',
  variantNumber: 'OGN-R01',
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
};

const battlefield = {
  cardId: 'bf-1',
  variantNumber: 'OGN-B01',
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
};

describe('RIFTBOUND_DECK_RULES', () => {
  test('exposes canonical section targets', () => {
    expect(RIFTBOUND_DECK_RULES.sections.legend.target).toBe(1);
    expect(RIFTBOUND_DECK_RULES.sections.champion.target).toBe(1);
    expect(RIFTBOUND_DECK_RULES.sections.mainDeck.target).toBe(39);
    expect(RIFTBOUND_DECK_RULES.sections.runes.target).toBe(12);
    expect(RIFTBOUND_DECK_RULES.sections.battlefields.target).toBe(3);
    expect(RIFTBOUND_DECK_RULES.sections.sideboard.target).toBe(10);
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.sections.sideboard.target).toBe(8);
  });

  test('DeckRulesResponse schema matches contract shape', () => {
    const payload = {
      data: {
        version: RIFTBOUND_DECK_RULES.version,
        rules: RIFTBOUND_DECK_RULES,
      },
    };
    expect(() => DeckRulesResponse.parse(payload)).not.toThrow();
  });
});

describe('validateRiftboundDeck', () => {
  test('requires legend and champion', () => {
    const input = DeckValidateInput.parse({
      legend: null,
      champion: null,
      mainDeck: [],
      runes: [],
      battlefields: [],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'missing_legend')).toBe(true);
    expect(messages.some((m) => m.code === 'missing_champion')).toBe(true);
  });

  test('requires champion tag match', () => {
    const input = DeckValidateInput.parse({
      legend: jinxLegend,
      champion: {
        ...jinxChampion,
        name: 'Ahri - Nine-Tailed Fox',
        tags: ['Ahri'],
      },
      mainDeck: [],
      runes: [],
      battlefields: [],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'champion_tag_mismatch')).toBe(true);
  });

  test('Constructed allows 10 sideboard cards and rejects 11', () => {
    const sideCards = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        card: {
          ...jinxChampion,
          cardId: `side-${String(index)}`,
          variantNumber: `OGN-S${String(index + 1).padStart(2, '0')}`,
          name: `Side Card ${String(index)}`,
          super: null,
          type: 'Spell',
          isSignature: false,
        },
        count: 1,
      }));

    const allowed = DeckValidateInput.parse({
      legend: jinxLegend,
      champion: jinxChampion,
      mainDeck: [],
      runes: [],
      battlefields: [],
      sideboard: sideCards(10),
    });
    expect(
      validateRiftboundDeck(allowed).some((m) => m.code === 'sideboard_count')
    ).toBe(false);

    const over = DeckValidateInput.parse({
      ...allowed,
      sideboard: sideCards(11),
    });
    expect(validateRiftboundDeck(over).some((m) => m.code === 'sideboard_count')).toBe(
      true
    );
  });

  test('accepts Darius legend and champion when tags are domain-only', () => {
    const dariusLegend = {
      ...jinxLegend,
      name: 'Darius, Hand of Noxus',
      tags: ['Noxus', 'Fury', 'Order'],
      colors: ['Fury', 'Order'],
    };
    const dariusChampion = {
      ...jinxChampion,
      name: 'Darius, Executioner',
      tags: ['Noxus', 'Fury'],
      colors: ['Fury'],
    };

    const input = DeckValidateInput.parse({
      legend: dariusLegend,
      champion: dariusChampion,
      mainDeck: [],
      runes: [],
      battlefields: [],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'champion_tag_mismatch')).toBe(false);
  });

  test('warns when rune total is not 12', () => {
    const input = DeckValidateInput.parse({
      legend: jinxLegend,
      champion: jinxChampion,
      mainDeck: [],
      runes: [{ card: furyRune, count: 8 }],
      battlefields: [],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'rune_count')).toBe(true);
  });

  test('validates a complete deck', () => {
    const mainDeck = Array.from({ length: 39 }, (_, i) => ({
      card: {
        ...jinxChampion,
        cardId: `main-${i}`,
        name: `Main Card ${i}`,
        super: null,
        type: 'Unit',
        isSignature: false,
      },
      count: 1,
    }));

    const input = DeckValidateInput.parse({
      legend: jinxLegend,
      champion: jinxChampion,
      mainDeck,
      runes: [{ card: furyRune, count: 12 }],
      battlefields: [
        { card: battlefield, count: 1 },
        {
          card: {
            ...battlefield,
            cardId: 'bf-2',
            name: 'Reaver Row',
            variantNumber: 'OGN-B02',
          },
          count: 1,
        },
        {
          card: {
            ...battlefield,
            cardId: 'bf-3',
            name: 'The Arena',
            variantNumber: 'OGN-B03',
          },
          count: 1,
        },
      ],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages).toEqual([
      { type: 'valid', code: 'deck_valid', message: 'Deck is valid!' },
    ]);
  });
});

describe('Pre-Rift validation', () => {
  test('exposes sealed section targets', () => {
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.sections.mainDeck.minimum).toBe(25);
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.maxDomains).toBe(3);
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.copyLimits.default).toBeNull();
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.copyLimits.battlefieldPerName).toBe(3);
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.sections.battlefields.required).toBe(false);
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.sections.battlefields.exact).toBe(false);
    expect(RIFTBOUND_PRE_RIFT_DECK_RULES.requireChampionTagMatch).toBe(false);
  });

  test('allows three domains and four copies of a card', () => {
    const calmCard = {
      ...jinxChampion,
      cardId: 'calm-1',
      name: 'Calm Unit',
      super: null,
      type: 'Unit',
      colors: ['Calm'],
      isSignature: false,
    };
    const orderCard = {
      ...calmCard,
      cardId: 'order-1',
      name: 'Order Unit',
      colors: ['Order'],
    };
    const chaosCard = {
      ...calmCard,
      cardId: 'chaos-1',
      name: 'Chaos Unit',
      colors: ['Chaos'],
    };

    const input = DeckValidateInput.parse({
      format: 'pre-rift',
      legend: {
        ...jinxLegend,
        name: 'Shen, Eye of Twilight',
        tags: ['Shen'],
        colors: ['Calm', 'Order'],
      },
      champion: {
        ...jinxChampion,
        name: 'Nasus, Ascended',
        tags: ['Nasus'],
        colors: ['Chaos'],
      },
      mainDeck: [
        { card: calmCard, count: 8 },
        { card: orderCard, count: 8 },
        { card: chaosCard, count: 4 },
        {
          card: {
            ...chaosCard,
            cardId: 'filler',
            name: 'Filler Unit',
            colors: ['Calm'],
          },
          count: 5,
        },
      ],
      runes: [
        { card: { ...furyRune, name: 'Calm Rune', colors: ['Calm'] }, count: 4 },
        {
          card: { ...furyRune, cardId: 'r2', name: 'Order Rune', colors: ['Order'] },
          count: 4,
        },
        {
          card: { ...furyRune, cardId: 'r3', name: 'Chaos Rune', colors: ['Chaos'] },
          count: 4,
        },
      ],
      battlefields: [{ card: battlefield, count: 3 }],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'champion_tag_mismatch')).toBe(false);
    expect(messages.some((m) => m.code === 'copy_limit')).toBe(false);
    expect(messages.some((m) => m.code === 'domain_cap')).toBe(false);
    expect(messages.some((m) => m.code === 'battlefield_unique')).toBe(false);
    expect(messages).toEqual([
      { type: 'valid', code: 'deck_valid', message: 'Deck is valid!' },
    ]);
  });

  test('Pre-Rift allows zero battlefields', () => {
    const calmCard = {
      ...jinxChampion,
      cardId: 'calm-1',
      name: 'Calm Unit',
      super: null,
      type: 'Unit',
      colors: ['Calm'],
      isSignature: false,
    };
    const orderCard = {
      ...calmCard,
      cardId: 'order-1',
      name: 'Order Unit',
      colors: ['Order'],
    };
    const chaosCard = {
      ...calmCard,
      cardId: 'chaos-1',
      name: 'Chaos Unit',
      colors: ['Chaos'],
    };

    const input = DeckValidateInput.parse({
      format: 'pre-rift',
      legend: {
        ...jinxLegend,
        name: 'Shen, Eye of Twilight',
        tags: ['Shen'],
        colors: ['Calm', 'Order'],
      },
      champion: {
        ...jinxChampion,
        name: 'Nasus, Ascended',
        tags: ['Nasus'],
        colors: ['Chaos'],
      },
      mainDeck: [
        { card: calmCard, count: 8 },
        { card: orderCard, count: 8 },
        { card: chaosCard, count: 4 },
        {
          card: {
            ...chaosCard,
            cardId: 'filler',
            name: 'Filler Unit',
            colors: ['Calm'],
          },
          count: 5,
        },
      ],
      runes: [
        { card: { ...furyRune, name: 'Calm Rune', colors: ['Calm'] }, count: 4 },
        {
          card: { ...furyRune, cardId: 'r2', name: 'Order Rune', colors: ['Order'] },
          count: 4,
        },
        {
          card: { ...furyRune, cardId: 'r3', name: 'Chaos Rune', colors: ['Chaos'] },
          count: 4,
        },
      ],
      battlefields: [],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'battlefield_count')).toBe(false);
    expect(messages).toEqual([
      { type: 'valid', code: 'deck_valid', message: 'Deck is valid!' },
    ]);
  });

  test('rejects a fourth domain', () => {
    const input = DeckValidateInput.parse({
      format: 'pre-rift',
      legend: {
        ...jinxLegend,
        colors: ['Calm', 'Order'],
      },
      champion: {
        ...jinxChampion,
        colors: ['Chaos'],
      },
      mainDeck: [
        {
          card: {
            ...jinxChampion,
            name: 'Body Unit',
            super: null,
            type: 'Unit',
            colors: ['Body'],
            isSignature: false,
          },
          count: 25,
        },
      ],
      runes: [{ card: furyRune, count: 12 }],
      battlefields: [
        { card: battlefield, count: 1 },
        {
          card: {
            ...battlefield,
            cardId: 'bf-2',
            name: 'Field Two',
            variantNumber: 'OGN-B02',
          },
          count: 1,
        },
        {
          card: {
            ...battlefield,
            cardId: 'bf-3',
            name: 'Field Three',
            variantNumber: 'OGN-B03',
          },
          count: 1,
        },
      ],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(messages.some((m) => m.code === 'domain_cap')).toBe(true);
  });

  test('treats missing legend as a warning, not an error', () => {
    const input = DeckValidateInput.parse({
      format: 'pre-rift',
      legend: null,
      champion: null,
      mainDeck: Array.from({ length: 25 }, (_, i) => ({
        card: {
          ...jinxChampion,
          cardId: `main-${i}`,
          name: `Main Card ${i}`,
          super: null,
          type: 'Unit',
          isSignature: false,
        },
        count: 1,
      })),
      runes: [{ card: furyRune, count: 12 }],
      battlefields: [
        { card: battlefield, count: 1 },
        {
          card: {
            ...battlefield,
            cardId: 'bf-2',
            name: 'Field Two',
            variantNumber: 'OGN-B02',
          },
          count: 1,
        },
        {
          card: {
            ...battlefield,
            cardId: 'bf-3',
            name: 'Field Three',
            variantNumber: 'OGN-B03',
          },
          count: 1,
        },
      ],
      sideboard: [],
    });

    const messages = validateRiftboundDeck(input);
    expect(
      messages.some((m) => m.code === 'missing_legend' && m.type === 'warning')
    ).toBe(true);
    expect(messages.some((m) => m.type === 'error')).toBe(false);
  });
});

describe('domainIdentityMatch', () => {
  test('allows colorless cards and requires every domain to be in identity', () => {
    const allowed = new Set(['Fury', 'Chaos']);
    expect(domainIdentityMatch([], allowed)).toBe(true);
    expect(domainIdentityMatch(['Fury'], allowed)).toBe(true);
    expect(domainIdentityMatch([' Fury ', 'Chaos'], allowed)).toBe(true);
    expect(domainIdentityMatch(['Fury', 'Calm'], allowed)).toBe(false);
  });
});
