import { describe, expect, test } from 'bun:test';
import {
  cardHasAnyType,
  cardHasCost,
  cardTypeMatchesFilters,
  cardTypeTokens,
  parseCardTypeFilters,
} from './card-types.js';

describe('cardTypeTokens', () => {
  test('splits dual types like Unit Gear', () => {
    expect(cardTypeTokens('Unit Gear')).toEqual(['unit', 'gear']);
    expect(cardTypeTokens('  Spell  ')).toEqual(['spell']);
    expect(cardTypeTokens('')).toEqual([]);
  });
});

describe('cardHasAnyType / cardTypeMatchesFilters', () => {
  test('Unit Gear matches Unit and Gear deck-builder filters', () => {
    expect(cardHasAnyType('Unit Gear', ['unit'])).toBe(true);
    expect(cardHasAnyType('Unit Gear', ['gear'])).toBe(true);
    expect(cardHasAnyType('Unit Gear', ['spell'])).toBe(false);
    expect(cardTypeMatchesFilters('Unit Gear', ['Unit', 'Gear', 'Spell'])).toBe(true);
  });

  test('exact single types still match', () => {
    expect(cardTypeMatchesFilters('Unit', ['unit'])).toBe(true);
    expect(cardTypeMatchesFilters('Gear', ['Unit', 'Gear', 'Spell'])).toBe(true);
    expect(cardTypeMatchesFilters('Legend', ['Unit', 'Gear', 'Spell'])).toBe(false);
  });

  test('does not use substring matching across tokens', () => {
    // Protect against naive `type.includes('unit')` regressions.
    expect(cardHasAnyType('Community', ['unit'])).toBe(false);
  });

  test('parseCardTypeFilters normalizes comma lists', () => {
    expect(parseCardTypeFilters('Unit,Gear,Spell')).toEqual(['unit', 'gear', 'spell']);
    expect(parseCardTypeFilters(' Unit , , Gear ')).toEqual(['unit', 'gear']);
  });
});

describe('cardHasCost', () => {
  test('Legends and Battlefields have no cost', () => {
    expect(cardHasCost('Legend')).toBe(false);
    expect(cardHasCost('Battlefield')).toBe(false);
  });

  test('playable cards keep their cost, including 0-cost ones', () => {
    expect(cardHasCost('Unit')).toBe(true);
    expect(cardHasCost('Spell')).toBe(true);
    expect(cardHasCost('Unit Gear')).toBe(true);
  });
});
