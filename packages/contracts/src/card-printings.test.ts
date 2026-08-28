import { describe, expect, test } from 'bun:test';
import type { CardListItem } from './cards.js';
import {
  dedupeFinishPrintings,
  getSearchGroupKey,
  groupCardListItems,
} from './card-printings.js';

function item(
  overrides: Partial<CardListItem> &
    Pick<CardListItem, 'variantNumber' | 'printings' | 'isBanned'>
): CardListItem {
  return {
    cardId: '11111111-1111-4111-8111-111111111111',
    name: 'Vi',
    type: 'Unit',
    energy: 2,
    might: 2,
    power: 2,
    rarity: 'Rare',
    setCode: 'OGN',
    colors: ['Body'],
    imageUrl: 'https://example.com/vi.webp',
    cardmarketId: 1,
    priceEur: null,
    ...overrides,
  };
}

describe('getSearchGroupKey', () => {
  test('groups foil with standard but keeps alternate art separate', () => {
    expect(getSearchGroupKey('OGN-001', 'Standard')).toBe('OGN-001');
    expect(getSearchGroupKey('OGN-001-Foil', 'Foil')).toBe('OGN-001');
    expect(getSearchGroupKey('SFD-R05a', 'Foil')).toBe('SFD-R05');
    expect(getSearchGroupKey('OGN-001a', 'Alt Art', 'Alternate Art')).toBe('OGN-001a');
  });
});

describe('groupCardListItems', () => {
  test('merges foil and non-foil rows and ORs isBanned', () => {
    const grouped = groupCardListItems([
      item({
        variantNumber: 'OGN-001',
        isBanned: false,
        printings: [
          {
            variantNumber: 'OGN-001',
            variantLabel: 'Standard',
            isFoil: false,
            priceEur: null,
          },
        ],
      }),
      item({
        variantNumber: 'OGN-001-Foil',
        isBanned: true,
        printings: [
          {
            variantNumber: 'OGN-001-Foil',
            variantLabel: 'Foil',
            isFoil: true,
            priceEur: null,
          },
        ],
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.printings).toHaveLength(2);
    expect(grouped[0]?.isBanned).toBe(true);
    expect(grouped[0]?.variantNumber).toBe('OGN-001');
  });
});

describe('dedupeFinishPrintings', () => {
  test('drops synthetic same-VN foil when a real -Foil sibling exists', () => {
    const deduped = dedupeFinishPrintings([
      {
        variantNumber: 'OGN-001',
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: null,
      },
      {
        variantNumber: 'OGN-001',
        variantLabel: 'Foil',
        isFoil: true,
        priceEur: null,
      },
      {
        variantNumber: 'OGN-001-Foil',
        variantLabel: 'Foil',
        isFoil: true,
        priceEur: null,
      },
    ]);
    expect(deduped.map((printing) => printing.variantNumber)).toEqual([
      'OGN-001',
      'OGN-001-Foil',
    ]);
  });
});
