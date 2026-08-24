import { describe, expect, test } from 'bun:test';
import type { DeckCard, DeckSectionKey } from './deck-types';
import { createEmptyDeck } from './deck-card';
import { isCardEligibleForSection } from './deck-eligibility';

function mockCard(overrides: Partial<DeckCard> & Pick<DeckCard, 'name'>): DeckCard {
  return {
    cardId: `id-${overrides.name}`,
    variantNumber: 'OGN-001',
    type: 'Unit',
    super: null,
    tags: [],
    colors: ['Fury'],
    energy: 2,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    imageUrl: null,
    ...overrides,
  };
}

const legendFuryCalm = mockCard({
  name: 'Jinx - Loose Cannon',
  type: 'Legend',
  tags: ['Jinx'],
  colors: ['Fury', 'Calm'],
  super: null,
});

const championJinx = mockCard({
  name: 'Jinx - Demolitionist',
  type: 'Unit',
  super: 'Champion',
  tags: ['Jinx'],
  colors: ['Fury'],
});

const championNotJinx = mockCard({
  name: 'Ahri - Nine-Tailed Fox',
  type: 'Unit',
  super: 'Champion',
  tags: ['Ahri'],
  colors: ['Fury'],
});

const mainUnitFury = mockCard({
  name: 'Flame Chompers',
  type: 'Unit',
  super: null,
  tags: [],
  colors: ['Fury'],
});

const mainUnitMind = mockCard({
  name: 'Mind Orb',
  type: 'Gear',
  super: null,
  tags: [],
  colors: ['Mind'],
});

const furyRune = mockCard({
  name: 'Fury Rune',
  type: 'Rune',
  super: null,
  colors: ['Fury'],
});

const battlefieldChaos = mockCard({
  name: 'Zaun Warrens',
  type: 'Battlefield',
  super: null,
  colors: ['Chaos'],
});

const signatureJinx = mockCard({
  name: 'Jinx Signature',
  type: 'Unit',
  super: null,
  tags: ['Jinx'],
  colors: ['Fury'],
  isSignature: true,
});

const signatureWrongTag = mockCard({
  name: 'Someone Else Signature',
  type: 'Unit',
  super: null,
  tags: ['Ahri'],
  colors: ['Fury'],
  isSignature: true,
});

function eligible(
  deck: ReturnType<typeof createEmptyDeck>,
  section: DeckSectionKey,
  candidate: DeckCard
) {
  return isCardEligibleForSection({ deck, section, candidateCard: candidate }).eligible;
}

describe('deck-eligibility', () => {
  test('filters main deck cards by Legend domain identity', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;

    expect(eligible(deck, 'mainDeck', mainUnitFury)).toBe(true);
    expect(eligible(deck, 'mainDeck', mainUnitMind)).toBe(false);
  });

  test('filters champion selection by Legend champion tag', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = null;

    expect(eligible(deck, 'champion', championJinx)).toBe(true);
    expect(eligible(deck, 'champion', championNotJinx)).toBe(false);
  });

  test('allows champion units regardless of legend domain colors', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({
      name: 'Sett, The Boss',
      type: 'Legend',
      tags: ['Sett'],
      colors: ['Body', 'Order'],
      super: null,
    });

    const brawler = mockCard({
      name: 'Sett, Brawler',
      type: 'Unit',
      super: 'Champion',
      tags: ['Sett'],
      colors: ['Body'],
    });
    const kingpin = mockCard({
      name: 'Sett, Kingpin',
      type: 'Unit',
      super: 'Champion',
      tags: ['Sett'],
      colors: ['Order'],
    });

    expect(eligible(deck, 'champion', brawler)).toBe(true);
    expect(eligible(deck, 'champion', kingpin)).toBe(true);
  });

  test('allows battlefields outside legend domain identity', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;

    expect(eligible(deck, 'battlefields', battlefieldChaos)).toBe(true);
  });

  test('matches Sett-style legends by champion tag', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({
      name: 'Sett, The Boss',
      type: 'Legend',
      tags: ['Sett'],
      colors: ['Body', 'Order'],
      super: null,
    });
    deck.champion = null;

    const settChampion = mockCard({
      name: 'Sett, Brawler',
      type: 'Unit',
      super: 'Champion',
      tags: ['Sett', 'Ionia'],
      colors: ['Body'],
    });

    const ahriChampion = mockCard({
      name: 'Ahri, Alluring',
      type: 'Unit',
      super: 'Champion',
      tags: ['Ahri'],
      colors: ['Body'],
    });

    expect(eligible(deck, 'champion', settChampion)).toBe(true);
    expect(eligible(deck, 'champion', ahriChampion)).toBe(false);
  });

  test('matches Sett champions when legend tags are wrong but name contains Sett', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({
      name: 'Sett, The Boss',
      type: 'Legend',
      tags: ['Body', 'Order'],
      colors: ['Body', 'Order'],
      super: null,
    });
    deck.champion = null;

    const settChampion = mockCard({
      name: 'Sett, Brawler',
      type: 'Unit',
      super: 'Champion',
      tags: ['Sett', 'Ionia'],
      colors: ['Body'],
    });

    expect(eligible(deck, 'champion', settChampion)).toBe(true);
  });

  test('matches Diana-style legends by primary name when tags are missing', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({
      name: 'Diana, Scorn of the Moon',
      type: 'Legend',
      tags: [],
      colors: ['Body', 'Mind'],
      super: null,
    });
    deck.champion = null;

    const dianaChampion = mockCard({
      name: 'Diana - Scorn of the Moon',
      type: 'Unit',
      super: 'Champion',
      tags: [],
      colors: ['Body'],
    });

    expect(eligible(deck, 'champion', dianaChampion)).toBe(true);
  });

  test('matches Darius legend and champion by primary name', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({
      name: 'Darius, Hand of Noxus',
      type: 'Legend',
      tags: ['Noxus', 'Fury', 'Order'],
      colors: ['Fury', 'Order'],
      super: null,
    });
    deck.champion = null;

    const dariusChampion = mockCard({
      name: 'Darius, Executioner',
      type: 'Unit',
      super: 'Champion',
      tags: ['Noxus', 'Fury'],
      colors: ['Fury'],
    });

    expect(eligible(deck, 'champion', dariusChampion)).toBe(true);
  });

  test('enforces max 3 copies for non-runes in main deck', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;
    deck.mainDeck.set(mainUnitFury.name, { card: mainUnitFury, count: 3 });

    expect(eligible(deck, 'mainDeck', mainUnitFury)).toBe(false);
  });

  test('enforces max 12 copies for runes', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;
    deck.runes.set(furyRune.name, { card: furyRune, count: 12 });

    expect(eligible(deck, 'runes', furyRune)).toBe(false);
  });

  test('allows battlefields when main deck has many other cards', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;
    for (let i = 0; i < 20; i += 1) {
      deck.mainDeck.set(`Unit ${i}`, {
        card: mockCard({ name: `Unit ${i}`, type: 'Unit' }),
        count: 3,
      });
    }

    expect(eligible(deck, 'battlefields', battlefieldChaos)).toBe(true);
  });

  test('enforces max 3 battlefields', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;
    deck.battlefields.set('Field A', {
      card: mockCard({ name: 'Field A', type: 'Battlefield' }),
      count: 1,
    });
    deck.battlefields.set('Field B', {
      card: mockCard({ name: 'Field B', type: 'Battlefield' }),
      count: 1,
    });
    deck.battlefields.set('Field C', {
      card: mockCard({ name: 'Field C', type: 'Battlefield' }),
      count: 1,
    });

    const fourth = mockCard({ name: 'Field D', type: 'Battlefield' });
    expect(eligible(deck, 'battlefields', fourth)).toBe(false);
  });

  test('enforces battlefield uniqueness by name', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;
    deck.battlefields.set(battlefieldChaos.name, { card: battlefieldChaos, count: 1 });

    expect(eligible(deck, 'battlefields', battlefieldChaos)).toBe(false);
  });

  test('enforces signature cap (matching Legend champion tag)', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;

    // Fill signature cap (3 matching signatures).
    deck.mainDeck.set('Jinx Sig 1', {
      card: { ...signatureJinx, name: 'Jinx Sig 1' },
      count: 1,
    });
    deck.mainDeck.set('Jinx Sig 2', {
      card: { ...signatureJinx, name: 'Jinx Sig 2' },
      count: 1,
    });
    deck.mainDeck.set(signatureJinx.name, { card: signatureJinx, count: 1 });

    expect(eligible(deck, 'mainDeck', signatureJinx)).toBe(false);
  });

  test('rejects signature cards that do not match Legend champion tag', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;
    deck.champion = championJinx;

    expect(eligible(deck, 'mainDeck', signatureWrongTag)).toBe(false);
  });

  test('Pre-Rift allows three domains and duplicate battlefields', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    deck.legend = legendFuryCalm;
    deck.champion = mockCard({
      name: 'Nasus Champion',
      type: 'Unit',
      super: 'Champion',
      tags: ['Nasus'],
      colors: ['Chaos'],
    });
    deck.battlefields.set(battlefieldChaos.name, { card: battlefieldChaos, count: 1 });

    expect(eligible(deck, 'battlefields', battlefieldChaos)).toBe(true);
    expect(
      eligible(
        deck,
        'mainDeck',
        mockCard({ name: 'Calm Unit', colors: ['Calm'], type: 'Unit' })
      )
    ).toBe(true);
  });

  test('Pre-Rift allows fourth domain in picker', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    deck.legend = legendFuryCalm;
    deck.champion = mockCard({
      name: 'Nasus Champion',
      type: 'Unit',
      super: 'Champion',
      tags: ['Nasus'],
      colors: ['Chaos'],
    });

    expect(
      eligible(
        deck,
        'mainDeck',
        mockCard({ name: 'Body Unit', colors: ['Body'], type: 'Unit' })
      )
    ).toBe(true);
  });

  test('Pre-Rift allows unlimited main deck copies in picker', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    const unit = mockCard({ name: 'Flame Chompers', type: 'Unit' });
    deck.mainDeck.set(unit.name, { card: unit, count: 5 });

    expect(eligible(deck, 'mainDeck', unit)).toBe(true);
  });

  test('Pre-Rift does not require champion tag match', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    deck.legend = legendFuryCalm;

    expect(
      eligible(
        deck,
        'champion',
        mockCard({
          name: 'Nasus Champion',
          type: 'Unit',
          super: 'Champion',
          tags: ['Nasus'],
          colors: ['Fury'],
        })
      )
    ).toBe(true);
  });

  test('Pre-Rift with legend allows a third-domain non-matching champion', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    deck.legend = legendFuryCalm;

    expect(
      eligible(
        deck,
        'champion',
        mockCard({
          name: 'Ahri Champion',
          type: 'Unit',
          super: 'Champion',
          tags: ['Ahri'],
          colors: ['Chaos'],
        })
      )
    ).toBe(true);
  });

  test('Constructed still requires champion tag match with legend', () => {
    const deck = createEmptyDeck();
    deck.legend = legendFuryCalm;

    expect(
      eligible(
        deck,
        'champion',
        mockCard({
          name: 'Ahri Champion',
          type: 'Unit',
          super: 'Champion',
          tags: ['Ahri'],
          colors: ['Fury'],
        })
      )
    ).toBe(false);
  });
});
