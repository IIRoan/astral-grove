import { describe, expect, test } from 'bun:test';
import type { CardDetail, CardListItem } from '@riftbound/contracts';
import { isSignatureCard } from '@riftbound/contracts';
import { getSectionCount } from '@/lib/deck-card';
import {
  DEFAULT_RANDOMIZER_SETTINGS,
  generateRandomDeck,
  type RandomizerSettings,
} from '@/lib/deck-randomizer';
import type { DeckState } from '@/lib/deck-types';
import { validateDeck } from '@/lib/deck-validation';

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAGS = new Map<string, string[]>();

function item(
  name: string,
  type: string,
  colors: string[],
  extra: Partial<CardListItem> & { tags?: string[] } = {}
): CardListItem {
  const { tags, ...overrides } = extra;
  const variantNumber = overrides.variantNumber ?? `OGN-${String(TAGS.size + 1)}`;
  TAGS.set(variantNumber, tags ?? []);
  return {
    cardId: `id-${name}`,
    variantNumber,
    name,
    type,
    super: null,
    variantType: 'Standard',
    energy: 2,
    might: 0,
    power: 0,
    rarity: 'Common',
    setCode: variantNumber.split('-')[0]!,
    colors,
    imageUrl: 'https://cdn.example.com/art.webp',
    cardmarketId: null,
    priceEur: null,
    printings: [
      { variantNumber, variantLabel: 'Standard', isFoil: false, priceEur: null },
    ],
    isBanned: false,
    ...overrides,
  };
}

function many(
  prefix: string,
  type: string,
  colors: string[],
  count: number,
  set = 'OGN'
) {
  return Array.from({ length: count }, (_, i) =>
    item(`${prefix} ${i + 1}`, type, colors, {
      variantNumber: `${set}-${prefix}${i + 1}`,
    })
  );
}

const CATALOG: CardListItem[] = [
  item('Jinx, Loose Cannon', 'Legend', ['Fury', 'Chaos'], { tags: ['Jinx'] }),
  item('Ahri, Nine-Tailed Fox', 'Legend', ['Calm', 'Mind'], {
    tags: ['Ahri'],
    variantNumber: 'SFD-1',
  }),
  item('Banned Legend', 'Legend', ['Fury', 'Chaos'], { isBanned: true }),
  item('Jinx, Demolitionist', 'Unit', ['Fury'], { super: 'Champion', tags: ['Jinx'] }),
  item('Darius, Trifarian', 'Unit', ['Fury'], { super: 'Champion', tags: ['Darius'] }),
  item('Ahri, Alluring', 'Unit', ['Calm'], {
    super: 'Champion',
    tags: ['Ahri'],
    variantNumber: 'SFD-2',
  }),
  item('Super Mega Death Rocket!', 'Spell', ['Fury', 'Chaos'], {
    super: 'Signature',
    tags: ['Jinx'],
  }),
  item('Noxian Guillotine', 'Spell', ['Fury'], {
    super: 'Signature',
    tags: ['Darius'],
  }),
  item('Banned Spell', 'Spell', ['Fury'], { isBanned: true }),
  item('Sprite', 'Unit', ['Fury'], { super: 'Token' }),
  ...many('Fury Unit', 'Unit', ['Fury'], 20),
  ...many('Chaos Spell', 'Spell', ['Chaos'], 20),
  ...many('Calm Unit', 'Unit', ['Calm'], 20, 'SFD'),
  ...many('Mind Gear', 'Gear', ['Mind'], 20, 'SFD'),
  item('Fury Rune', 'Rune', ['Fury'], {
    super: 'Basic',
    variantNumber: 'OGN-007b',
    variantType: 'Promo',
  }),
  item('Fury Rune', 'Rune', ['Fury'], { super: 'Basic', variantNumber: 'OGN-007' }),
  item('Chaos Rune', 'Rune', ['Chaos'], { super: 'Basic' }),
  item('Calm Rune', 'Rune', ['Calm'], { super: 'Basic' }),
  item('Mind Rune', 'Rune', ['Mind'], { super: 'Basic' }),
  ...many('Field', 'Battlefield', [], 3),
  ...many('Far Field', 'Battlefield', [], 3, 'SFD'),
];

async function fetchDetails(
  variantNumbers: string[]
): Promise<Map<string, CardDetail>> {
  const map = new Map<string, CardDetail>();
  for (const listItem of CATALOG) {
    if (!variantNumbers.includes(listItem.variantNumber)) continue;
    map.set(listItem.variantNumber, {
      id: listItem.cardId,
      name: listItem.name,
      type: listItem.type,
      super: listItem.super ?? null,
      description: '',
      energy: listItem.energy,
      might: listItem.might,
      power: listItem.power,
      tags: TAGS.get(listItem.variantNumber) ?? [],
      colors: listItem.colors.map((name) => ({ id: name, name })),
      variants: [
        {
          id: listItem.variantNumber,
          variantNumber: listItem.variantNumber,
          rarity: listItem.rarity,
          variantType: 'Standard',
          variantLabel: 'Standard',
          foilMode: 'none',
          imageUrl: listItem.imageUrl,
          cardmarketId: null,
          tcgplayerId: null,
          releaseDate: null,
          artist: null,
          prices: [],
        },
      ],
      banEffectiveDate: null,
    });
  }
  return map;
}

function allCards(deck: DeckState) {
  return [deck.mainDeck, deck.runes, deck.battlefields].flatMap((section) => [
    ...section.values(),
  ]);
}

function generate(seed: number, settings: Partial<RandomizerSettings> = {}) {
  return generateRandomDeck(
    CATALOG,
    { ...DEFAULT_RANDOMIZER_SETTINGS, ...settings },
    fetchDetails,
    seeded(seed)
  );
}

describe('generateRandomDeck', () => {
  test('always builds a deck that passes Constructed validation', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const deck = await generate(seed);
      expect(validateDeck(deck).map((m) => m.type)).toEqual(['valid']);
      expect(getSectionCount(deck, 'mainDeck')).toBe(39);
      expect(getSectionCount(deck, 'runes')).toBe(12);
      expect(getSectionCount(deck, 'battlefields')).toBe(3);
      expect(deck.legend?.name).not.toBe('Banned Legend');
      const names = allCards(deck).map((entry) => entry.card.name);
      expect(names).not.toContain('Banned Spell');
      expect(names).not.toContain('Sprite');
      expect(names).not.toContain('Noxian Guillotine');
    }
  });

  test('picks different legends across rolls', async () => {
    const legends = new Set<string>();
    for (let seed = 1; seed <= 20; seed++)
      legends.add((await generate(seed)).legend!.name);
    expect(legends).toEqual(new Set(['Jinx, Loose Cannon', 'Ahri, Nine-Tailed Fox']));
  });

  test('uses hydrated tags so legend-matched signatures can appear', async () => {
    let sawSignature = false;
    for (let seed = 1; seed <= 40 && !sawSignature; seed++) {
      const deck = await generate(seed, { domains: ['Fury', 'Chaos'] });
      sawSignature = [...deck.mainDeck.values()].some((entry) =>
        isSignatureCard(entry.card)
      );
    }
    expect(sawSignature).toBe(true);
  });

  test('copies setting controls per-card counts', async () => {
    const singleton = await generate(3, { copies: 'singleton' });
    expect([...singleton.mainDeck.values()].every((e) => e.count === 1)).toBe(true);

    const playset = await generate(3, { copies: 'playset' });
    const counts = [...playset.mainDeck.values()].map((e) => e.count);
    expect(Math.max(...counts)).toBe(3);
    expect(counts.filter((count) => count === 3).length).toBeGreaterThanOrEqual(11);
  });

  test('domains setting keeps the legend inside the chosen domains', async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const deck = await generate(seed, { domains: ['Calm', 'Mind', 'Body'] });
      expect(deck.legend?.name).toBe('Ahri, Nine-Tailed Fox');
    }
  });

  test('sets setting limits every non-rune card to those sets', async () => {
    const deck = await generate(5, { sets: ['OGN'] });
    expect(deck.legend?.setCode).toBe('OGN');
    expect(deck.champion?.setCode).toBe('OGN');
    for (const entry of [...deck.mainDeck.values(), ...deck.battlefields.values()]) {
      expect(entry.card.setCode).toBe('OGN');
    }
  });

  test('prefers the standard printing when a card has several', async () => {
    const deck = await generate(1, { domains: ['Fury', 'Chaos'] });
    expect(deck.runes.get('Fury Rune')?.card.variantNumber).toBe('OGN-007');
  });

  test('explains why settings cannot produce a deck', async () => {
    expect(generate(1, { domains: ['Order'] })).rejects.toThrow(
      'No legend matches these settings.'
    );
    const thin = CATALOG.filter((card) => !/^(Fury Unit|Chaos Spell)/.test(card.name));
    expect(
      generateRandomDeck(
        thin,
        { ...DEFAULT_RANDOMIZER_SETTINGS, domains: ['Fury', 'Chaos'] },
        fetchDetails,
        seeded(1)
      )
    ).rejects.toThrow('Main Deck has');
  });
});
