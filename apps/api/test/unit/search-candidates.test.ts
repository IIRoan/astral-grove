import { describe, expect, test } from 'bun:test';
import {
  groupSearchCandidateRows,
  sortCandidateGroupsLexically,
  type SearchCandidateGroup,
} from '../../src/lib/search-candidates.js';
import type { ListItemDbRow } from '../../src/services/card-mapper.js';

function row(overrides: Partial<ListItemDbRow> & Pick<ListItemDbRow, 'variantNumber'>): ListItemDbRow {
  return {
    cardId: '00000000-0000-0000-0000-000000000001',
    name: 'Jinx',
    type: 'Unit',
    super: null,
    energy: 2,
    might: 2,
    power: 1,
    banEffectiveDate: null,
    variantId: overrides.variantId ?? '00000000-0000-0000-0000-000000000011',
    rarity: 'Rare',
    variantType: 'Standard',
    foilMode: 'none',
    variantLabel: 'Standard',
    imageUrl: 'https://example.com/jinx.webp',
    cardmarketId: null,
    tcgplayerId: null,
    setCode: 'OGN',
    ...overrides,
  };
}

describe('groupSearchCandidateRows', () => {
  test('keeps foil siblings together and alternate art separate', () => {
    const groups = groupSearchCandidateRows([
      row({ variantNumber: 'OGN-001', variantLabel: 'Standard' }),
      row({
        variantId: '00000000-0000-0000-0000-000000000012',
        variantNumber: 'OGN-001-Foil',
        variantLabel: 'Foil',
        foilMode: 'foil_only',
      }),
      row({
        variantId: '00000000-0000-0000-0000-000000000013',
        variantNumber: 'OGN-001-Release',
        variantLabel: 'Release Event Promo',
      }),
    ]);
    expect(groups).toHaveLength(2);
    const keys = groups.map((group) => group.key);
    expect(keys.some((key) => key.endsWith('OGN-001'))).toBe(true);
    expect(keys.some((key) => key.endsWith('OGN-001-Release'))).toBe(true);
  });

  test('does not merge two cards that share a printing family suffix', () => {
    const groups = groupSearchCandidateRows([
      row({ variantNumber: 'OGN-001' }),
      row({
        cardId: '00000000-0000-0000-0000-000000000002',
        variantId: '00000000-0000-0000-0000-000000000021',
        variantNumber: 'OGN-002',
        name: 'Vi Destructive',
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group.cardId)).size).toBe(2);
  });
});

describe('sortCandidateGroupsLexically', () => {
  test('keeps Ambessa legend ahead of a tagged unit', () => {
    const legend: SearchCandidateGroup = {
      key: 'legend',
      cardId: '00000000-0000-0000-0000-000000000001',
      rows: [
        row({
          name: 'Ambessa, Matriarch of War',
          type: 'Legend',
          variantNumber: 'VEN-153',
        }),
      ],
    };
    const unit: SearchCandidateGroup = {
      key: 'unit',
      cardId: '00000000-0000-0000-0000-000000000002',
      rows: [
        row({
          cardId: '00000000-0000-0000-0000-000000000002',
          name: 'Hungry Wolf',
          type: 'Unit',
          variantNumber: 'VEN-125',
        }),
      ],
    };
    const ordered = sortCandidateGroupsLexically([unit, legend], 'ambessa');
    expect(ordered[0]?.key).toBe('legend');
  });
});
