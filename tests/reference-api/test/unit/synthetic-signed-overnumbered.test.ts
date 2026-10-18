import { describe, expect, test } from 'bun:test';
import type { PaVariant } from '@riftbound/contracts';
import {
  buildSyntheticSignedOvernumbered,
  isSignedOvernumbered,
  isUnsignedOvernumbered,
  leftoverCardmarketProducts,
  signedOvernumberedVariantNumber,
} from '../../src/lib/synthetic-signed-overnumbered.js';
import type { CardmarketProduct } from '../../src/upstream/cardmarket-products.js';

function product(idProduct: number): CardmarketProduct {
  return {
    idProduct,
    name: 'Akali, Rogue Assassin',
    idCategory: 1655,
    idExpansion: 6587,
  };
}

const parent = {
  id: 'd5347b85-901c-4add-b920-2f2c97a6daec',
  variantNumber: 'VEN-189',
  imageUrl: 'https://cdn.piltoverarchive.com/cards/VEN-189.webp',
  rarity: 'Showcase',
  variantType: 'Overnumbered',
  foilMode: 'foil_only',
  variantTypes: ['Overnumbered'],
  showInLibrary: true,
  isCollectible: true,
  variantLabel: 'Overnumbered',
  flavorText: null,
  artist: 'Jessica Oyhenart',
  releaseDate: '2026-07-11',
  cardmarketId: 898141,
  tcgplayerId: null,
  parentVariantId: null,
  set: {
    id: 'f57ec3c2-aebf-49b6-a6ef-cb8970e1897c',
    name: 'Vendetta',
    prefix: 'VEN',
    releaseDate: '2026-07-31',
  },
} satisfies PaVariant;

describe('synthetic signed overnumbered', () => {
  test('builds VEN-189* from the overnumbered parent and leftover CM id', () => {
    const signed = buildSyntheticSignedOvernumbered(parent, 898161, {
      id: '11111111-1111-1111-1111-111111111111',
      // No dedicated PA signed asset yet — keep parent Overnumbered art.
      imageUrl: null,
    });
    expect(signed.variantNumber).toBe('VEN-189*');
    expect(signed.variantLabel).toBe('Overnumbered Signed');
    expect(signed.variantType).toBe('Overnumbered');
    expect(signed.variantTypes).toEqual(['Overnumbered', 'Signed']);
    expect(signed.cardmarketId).toBe(898161);
    expect(signed.parentVariantId).toBe(parent.id);
    expect(signed.imageUrl).toBe(parent.imageUrl);
  });

  test('classifies unsigned vs signed overnumbered labels', () => {
    expect(isUnsignedOvernumbered(parent)).toBe(true);
    expect(
      isSignedOvernumbered({
        variantNumber: 'VEN-189*',
        variantLabel: 'Overnumbered Signed',
        variantType: 'Overnumbered',
      })
    ).toBe(true);
    expect(signedOvernumberedVariantNumber('VEN-189')).toBe('VEN-189*');
  });

  test('does not classify alt-art or promo signed as Overnumbered Signed', () => {
    expect(
      isSignedOvernumbered({
        variantNumber: 'VEN-038s',
        variantLabel: 'Alt Art Signed',
        variantType: 'Alt Art',
      })
    ).toBe(false);
    expect(
      isSignedOvernumbered({
        variantNumber: 'VEN-100p',
        variantLabel: 'Promo Signed',
        variantType: 'Promo',
      })
    ).toBe(false);
    expect(
      isUnsignedOvernumbered({
        variantLabel: 'Alt Art Signed',
        variantType: 'Alt Art',
      })
    ).toBe(false);
  });

  test('orders leftover products by foil trend descending', () => {
    const leftovers = leftoverCardmarketProducts(
      [product(898093), product(898141), product(898161)],
      new Set([898093, 898141]),
      new Map([
        [898093, 0.13],
        [898141, 262],
        [898161, 1718],
      ])
    );
    expect(leftovers.map((row) => row.idProduct)).toEqual([898161]);
  });

  test('falls back to higher product ids when price ranks are missing', () => {
    const leftovers = leftoverCardmarketProducts(
      [product(898093), product(898141), product(898161)],
      new Set([898093, 898141])
    );
    expect(leftovers.map((row) => row.idProduct)).toEqual([898161]);
  });
});
