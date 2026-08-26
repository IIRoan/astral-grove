import { describe, expect, test } from 'bun:test';
import { createEmptyDeck } from '@/lib/deck-card';
import {
  catalogPowerByCard,
  collapseEnergyBuckets,
  computeDeckStats,
  countScaleMax,
  countScaleTicks,
  formatDeckStatAverage,
  LIST_ENERGY_CAP,
  peakBucketIndex,
} from '@/lib/deck-stats';
import type { DeckCard } from '@/lib/deck-types';

function card(overrides: Partial<DeckCard> & Pick<DeckCard, 'name'>): DeckCard {
  return {
    cardId: `id-${overrides.name}`,
    variantNumber: 'OGN-001',
    type: 'Unit',
    super: null,
    tags: [],
    colors: ['Calm'],
    energy: 2,
    power: 1,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    ...overrides,
  };
}

describe('computeDeckStats', () => {
  test('empty deck plots energy 0–8 and power 0–4 with no averages', () => {
    const stats = computeDeckStats(createEmptyDeck());
    expect(stats.cardCount).toBe(0);
    expect(stats.cardTarget).toBe(40);
    expect(stats.avgEnergy).toBeNull();
    expect(stats.avgPower).toBeNull();
    expect(stats.energy.map((bucket) => bucket.value)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(stats.power.map((bucket) => bucket.value)).toEqual([0, 1, 2, 3, 4]);
    expect(stats.energy.every((bucket) => bucket.count === 0)).toBe(true);
    expect(stats.domains).toEqual([]);
    expect(stats.types).toEqual([]);
    expect(stats.bands).toEqual([]);
    expect(stats.copies).toEqual([]);
    expect(stats.rarities).toEqual([]);
    expect(stats.facts).toEqual([
      { key: 'unique', label: 'Unique', count: 0 },
      { key: 'dual', label: 'Dual', count: 0 },
      { key: 'signature', label: 'Signature', count: 0 },
    ]);
  });

  test('counts main deck plus champion and ignores sideboard, runes, legend', () => {
    const deck = createEmptyDeck();
    deck.legend = card({
      name: 'Jinx Legend',
      type: 'Legend',
      colors: ['Fury', 'Chaos'],
    });
    deck.champion = card({
      name: 'Jinx',
      type: 'Unit',
      super: 'Champion',
      energy: 1,
      power: 2,
      colors: ['Fury'],
    });
    deck.mainDeck.set('Calm Unit', {
      card: card({ name: 'Calm Unit', energy: 2, power: 1, colors: ['Calm'] }),
      count: 3,
    });
    deck.sideboard.set('Side Spell', {
      card: card({
        name: 'Side Spell',
        type: 'Spell',
        energy: 8,
        power: 0,
        colors: ['Chaos'],
      }),
      count: 2,
    });
    deck.runes.set('Calm Rune', {
      card: card({
        name: 'Calm Rune',
        type: 'Rune',
        energy: 0,
        power: 0,
        colors: ['Calm'],
      }),
      count: 12,
    });

    const stats = computeDeckStats(deck);
    expect(stats.cardCount).toBe(4);
    expect(stats.energy[1]?.count).toBe(1);
    expect(stats.energy[2]?.count).toBe(3);
    expect(stats.energy[2]?.stack).toEqual([{ domain: 'Calm', count: 3 }]);
    expect(stats.energy[1]?.stack).toEqual([{ domain: 'Fury', count: 1 }]);
    expect(stats.energy[8]?.count).toBe(0);
    expect(stats.avgEnergy).toBeCloseTo((1 + 2 * 3) / 4);
    expect(stats.avgPower).toBeCloseTo((2 + 1 * 3) / 4);
    expect(stats.domains.map((item) => item.key)).toEqual(['Fury', 'Calm']);
    expect(stats.domains.find((item) => item.key === 'Fury')?.count).toBe(1);
    expect(stats.domains.find((item) => item.key === 'Calm')?.count).toBe(3);
  });

  test('counts dual-domain cards in both domain totals', () => {
    const deck = createEmptyDeck();
    deck.mainDeck.set('Split', {
      card: card({ name: 'Split', colors: ['Calm', 'Chaos'], energy: 3, power: 0 }),
      count: 2,
    });
    deck.mainDeck.set('Calm Only', {
      card: card({ name: 'Calm Only', colors: ['Calm'], energy: 3, power: 0 }),
      count: 1,
    });

    const stats = computeDeckStats(deck);
    expect(stats.cardCount).toBe(3);
    expect(stats.domains.find((item) => item.key === 'Calm')?.count).toBe(3);
    expect(stats.domains.find((item) => item.key === 'Chaos')?.count).toBe(2);
    expect(stats.energy[3]?.count).toBe(3);
    expect(stats.energy[3]?.byDomain).toEqual([
      { domain: 'Calm', count: 3 },
      { domain: 'Chaos', count: 2 },
    ]);
    expect(stats.energy[3]?.stack).toEqual([{ domain: 'Calm', count: 3 }]);
    expect(stats.energy[3]?.stack.reduce((sum, slice) => sum + slice.count, 0)).toBe(
      stats.energy[3]?.count
    );
  });

  test('stacks mixed costs by primary domain so segments sum to the bar', () => {
    const deck = createEmptyDeck();
    deck.mainDeck.set('Calm 2', {
      card: card({ name: 'Calm 2', colors: ['Calm'], energy: 2, power: 0 }),
      count: 4,
    });
    deck.mainDeck.set('Chaos 2', {
      card: card({ name: 'Chaos 2', colors: ['Chaos'], energy: 2, power: 0 }),
      count: 2,
    });

    const stats = computeDeckStats(deck);
    expect(stats.energy[2]?.count).toBe(6);
    expect(stats.energy[2]?.stack).toEqual([
      { domain: 'Calm', count: 4 },
      { domain: 'Chaos', count: 2 },
    ]);
  });

  test('classifies Unit Gear as Unit and lists only present types', () => {
    const deck = createEmptyDeck();
    deck.mainDeck.set('Blade', {
      card: card({ name: 'Blade', type: 'Unit Gear', energy: 2, power: 1 }),
      count: 2,
    });
    deck.mainDeck.set('Bolt', {
      card: card({ name: 'Bolt', type: 'Spell', energy: 1, power: 0 }),
      count: 4,
    });

    const stats = computeDeckStats(deck);
    expect(stats.types).toEqual([
      { key: 'Unit', label: 'Unit', count: 2, kind: 'type' },
      { key: 'Spell', label: 'Spell', count: 4, kind: 'type' },
    ]);
  });

  test('uses catalog power when the saved card omitted it', () => {
    const deck = createEmptyDeck();
    const { power: _omitted, ...legacy } = card({ name: 'Old', energy: 4 });
    deck.mainDeck.set('Old', { card: legacy, count: 2 });
    const stats = computeDeckStats(
      deck,
      catalogPowerByCard([{ cardId: 'id-Old', name: 'Old', power: 3 }])
    );
    expect(stats.avgPower).toBe(3);
    expect(stats.power[3]?.count).toBe(2);
  });

  test('uses Pre-Rift main target of 25', () => {
    const deck = createEmptyDeck('Sealed', '', 'pre-rift');
    const stats = computeDeckStats(deck);
    expect(stats.cardTarget).toBe(25);
  });

  test('groups energy into low mid high bands and copy density by unique name', () => {
    const deck = createEmptyDeck();
    deck.champion = card({
      name: 'Jinx',
      energy: 1,
      rarity: 'Rare',
      isSignature: true,
    });
    deck.mainDeck.set('Cheap', {
      card: card({ name: 'Cheap', energy: 2, rarity: 'Common' }),
      count: 3,
    });
    deck.mainDeck.set('Mid', {
      card: card({ name: 'Mid', energy: 4, rarity: 'Uncommon' }),
      count: 2,
    });
    deck.mainDeck.set('Split', {
      card: card({
        name: 'Split',
        energy: 7,
        colors: ['Calm', 'Order'],
        rarity: 'Epic',
      }),
      count: 1,
    });

    const stats = computeDeckStats(deck);
    expect(stats.bands).toEqual([
      { key: 'low', label: 'Low 0–2', count: 4, kind: 'mix' },
      { key: 'mid', label: 'Mid 3–5', count: 2, kind: 'mix' },
      { key: 'high', label: 'High 6+', count: 1, kind: 'mix' },
    ]);
    expect(stats.copies).toEqual([
      { key: '1', label: '1-of', count: 2, kind: 'mix' },
      { key: '2', label: '2-of', count: 1, kind: 'mix' },
      { key: '3', label: '3-of', count: 1, kind: 'mix' },
    ]);
    expect(stats.rarities.map((item) => item.key)).toEqual([
      'Common',
      'Uncommon',
      'Rare',
      'Epic',
    ]);
    expect(stats.rarities.find((item) => item.key === 'Common')?.count).toBe(3);
    expect(stats.facts).toEqual([
      { key: 'unique', label: 'Unique', count: 4 },
      { key: 'dual', label: 'Dual', count: 1 },
      { key: 'signature', label: 'Signature', count: 1 },
    ]);
  });
});

describe('countScaleMax', () => {
  test('steps to an even count ceiling so mid ticks stay whole cards', () => {
    expect(countScaleMax(0)).toBe(4);
    expect(countScaleMax(4)).toBe(4);
    expect(countScaleMax(8)).toBe(8);
    expect(countScaleMax(15)).toBe(16);
    expect(countScaleMax(16)).toBe(16);
    expect(countScaleMax(21)).toBe(22);
  });
});

describe('countScaleTicks', () => {
  test('returns integer card counts', () => {
    expect(countScaleTicks(countScaleMax(21))).toEqual([22, 11, 0]);
    expect(countScaleTicks(4)).toEqual([4, 2, 0]);
  });
});

describe('formatDeckStatAverage', () => {
  test('formats one decimal or an em dash', () => {
    expect(formatDeckStatAverage(2.5)).toBe('2.5');
    expect(formatDeckStatAverage(0)).toBe('0.0');
    expect(formatDeckStatAverage(null)).toBe('—');
  });
});

describe('peakBucketIndex', () => {
  test('selects the densest cost', () => {
    const stats = computeDeckStats(createEmptyDeck());
    const deck = createEmptyDeck();
    deck.mainDeck.set('A', { card: card({ name: 'A', energy: 1 }), count: 2 });
    deck.mainDeck.set('B', { card: card({ name: 'B', energy: 3 }), count: 5 });
    const filled = computeDeckStats(deck);
    expect(peakBucketIndex(stats.energy)).toBe(0);
    expect(peakBucketIndex(filled.energy)).toBe(3);
  });
});

describe('collapseEnergyBuckets', () => {
  test('folds 6+ into a labeled overflow while keeping 0–5', () => {
    const deck = createEmptyDeck();
    deck.mainDeck.set('Low', { card: card({ name: 'Low', energy: 2 }), count: 3 });
    deck.mainDeck.set('Six', { card: card({ name: 'Six', energy: 6 }), count: 2 });
    deck.mainDeck.set('Eight', { card: card({ name: 'Eight', energy: 8 }), count: 1 });
    const collapsed = collapseEnergyBuckets(computeDeckStats(deck).energy);
    expect(collapsed.map((bucket) => bucket.label ?? String(bucket.value))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6+',
    ]);
    expect(collapsed[2]?.count).toBe(3);
    expect(collapsed[LIST_ENERGY_CAP]?.count).toBe(3);
    expect(collapsed[LIST_ENERGY_CAP]?.label).toBe('6+');
  });

  test('pads missing low costs so the list axis stays stable', () => {
    const collapsed = collapseEnergyBuckets([]);
    expect(collapsed).toHaveLength(LIST_ENERGY_CAP + 1);
    expect(collapsed.every((bucket) => bucket.count === 0)).toBe(true);
  });
});
