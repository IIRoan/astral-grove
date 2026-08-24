import { describe, expect, test } from 'bun:test';
import {
  buildSetExpansionMap,
  inferExpansionId,
  matchVariantsToProducts,
  type VariantForCardmarketMatch,
} from '../../src/lib/cardmarket-id-match.js';
import type { CardmarketProduct } from '../../src/upstream/cardmarket-products.js';

function product(
  idProduct: number,
  name: string,
  idExpansion = 6587
): CardmarketProduct {
  return {
    idProduct,
    name,
    idCategory: 1655,
    idExpansion,
  };
}

function variant(
  variantNumber: string,
  variantLabel: string,
  variantType = variantLabel
): VariantForCardmarketMatch {
  return { variantNumber, variantLabel, variantType, rarity: 'Rare' };
}

describe('matchVariantsToProducts', () => {
  test('pairs equal counts in variant-number / product-id order', () => {
    const matches = matchVariantsToProducts(
      [variant('VEN-038', 'Standard'), variant('VEN-038a', 'Alt Art', 'Alt Art')],
      [product(897976, 'Akali, Silent'), product(897977, 'Akali, Silent')]
    );

    expect(matches.get('VEN-038')).toBe(897976);
    expect(matches.get('VEN-038a')).toBe(897977);
  });

  test('leaves unsigned premium on mid-tier when Cardmarket has an extra signed SKU', () => {
    const matches = matchVariantsToProducts(
      [
        variant('VEN-139', 'Standard'),
        variant('VEN-189', 'Overnumbered', 'Overnumbered'),
      ],
      [
        product(898093, 'Akali, Rogue Assassin'),
        product(898141, 'Akali, Rogue Assassin'),
        product(898161, 'Akali, Rogue Assassin'),
      ],
      new Map([
        [898093, 0.18],
        [898141, 207.45],
        [898161, 1712.39],
      ])
    );

    expect(matches.get('VEN-139')).toBe(898093);
    expect(matches.get('VEN-189')).toBe(898141);
    expect(matches.size).toBe(2);
  });

  test('gives signed catalog printings the highest leftover Cardmarket products', () => {
    const matches = matchVariantsToProducts(
      [
        variant('VEN-145', 'Standard'),
        variant('VEN-192', 'Overnumbered', 'Overnumbered'),
        variant('VEN-192*', 'Overnumbered Signed', 'Overnumbered'),
      ],
      [
        product(898099, 'Nasus, Curator of the Sands'),
        product(898144, 'Nasus, Curator of the Sands'),
        product(898164, 'Nasus, Curator of the Sands'),
        product(898999, 'Nasus, Curator of the Sands'),
      ],
      new Map([
        [898099, 0.2],
        [898144, 40],
        [898164, 900],
        [898999, 1200],
      ])
    );

    expect(matches.get('VEN-145')).toBe(898099);
    expect(matches.get('VEN-192')).toBe(898144);
    expect(matches.get('VEN-192*')).toBe(898999);
  });

  test('uses product id ordering when price ranks are absent', () => {
    const matches = matchVariantsToProducts(
      [
        variant('VEN-139', 'Standard'),
        variant('VEN-189', 'Overnumbered', 'Overnumbered'),
      ],
      [
        product(898093, 'Akali, Rogue Assassin'),
        product(898141, 'Akali, Rogue Assassin'),
        product(898161, 'Akali, Rogue Assassin'),
      ]
    );

    expect(matches.get('VEN-139')).toBe(898093);
    expect(matches.get('VEN-189')).toBe(898141);
    expect(matches.size).toBe(2);
  });

  test('does not treat alt-art signed as Overnumbered Signed for leftover assignment', () => {
    const matches = matchVariantsToProducts(
      [
        variant('VEN-038', 'Standard'),
        variant('VEN-038s', 'Alt Art Signed', 'Alt Art'),
        variant('VEN-189', 'Overnumbered', 'Overnumbered'),
      ],
      [
        product(897976, 'Akali, Silent'),
        product(897977, 'Akali, Silent'),
        product(897978, 'Akali, Silent'),
        product(898161, 'Akali, Silent'),
      ],
      new Map([
        [897976, 0.2],
        [897977, 15],
        [897978, 200],
        [898161, 1700],
      ])
    );

    expect(matches.get('VEN-038')).toBe(897976);
    // Alt Art Signed is unsigned-premium for leftover purposes — mid tiers, not top SKU
    expect(matches.get('VEN-038s')).toBe(897977);
    expect(matches.get('VEN-189')).toBe(897978);
    expect(matches.has('VEN-189*')).toBe(false);
    expect(matches.size).toBe(3);
  });
});

describe('buildSetExpansionMap', () => {
  test('picks the most common expansion for each set code', () => {
    const products = new Map<number, CardmarketProduct>([
      [847189, product(847189, 'Caitlyn, Patrolling', 6286)],
      [858988, product(858988, 'Caitlyn, Patrolling', 6322)],
    ]);

    const map = buildSetExpansionMap(
      [
        { setCode: 'OGN', cardmarketId: 847189 },
        { setCode: 'OGN', cardmarketId: 847189 },
        { setCode: 'ARC', cardmarketId: 858988 },
      ],
      products
    );

    expect(map.get('OGN')).toBe(6286);
    expect(map.get('ARC')).toBe(6322);
  });
});

describe('inferExpansionId', () => {
  test('picks the expansion with the most name overlap', () => {
    const expansionId = inferExpansionId(
      [{ cardName: 'Akali, Silent' }, { cardName: 'Morgana, Vindictive' }],
      new Map([
        [
          '6587',
          [
            product(897976, 'Akali, Silent', 6587),
            product(897952, 'Morgana, Vindictive', 6587),
          ],
        ],
        ['6286', [product(847189, 'Caitlyn, Patrolling', 6286)]],
      ])
    );

    expect(expansionId).toBe(6587);
  });
});
