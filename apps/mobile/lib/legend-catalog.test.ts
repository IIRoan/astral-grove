import { describe, expect, test } from 'bun:test';
import {
  buildPlayLegendRows,
  groupLegendListItems,
  PLAY_LEGEND_DETAIL_DEFER_MS,
  PLAY_LEGEND_PAGE_SIZE,
  PLAY_LEGEND_SEARCH_DEBOUNCE_MS,
  PLAY_LEGEND_STALE_MS,
  playLegendDetailsQueryKey,
  playLegendListQueryKey,
  playScoreHintClasses,
  resolveDisplayedLegends,
  shouldShowLegendCatalogLoading,
} from '@/lib/legend-catalog';
import type { CardDetail, CardListItem } from '@riftbound/contracts';

function listItem(
  overrides: Partial<CardListItem> &
    Pick<CardListItem, 'name' | 'variantNumber' | 'cardId'>
): CardListItem {
  return {
    type: 'Legend',
    imageUrl: 'https://cdn.example.com/art.webp',
    priceEur: null,
    energy: 0,
    might: 0,
    power: 0,
    rarity: 'Rare',
    setCode: 'OGN',
    colors: ['Chaos'],
    cardmarketId: null,
    isBanned: false,
    printings: [
      {
        variantNumber: overrides.variantNumber,
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: null,
      },
    ],
    ...overrides,
  };
}

describe('legend catalog cache policy', () => {
  test('keeps pages warm for half an hour', () => {
    expect(PLAY_LEGEND_STALE_MS).toBe(30 * 60 * 1000);
  });

  test('debounces search quickly without thrashing', () => {
    expect(PLAY_LEGEND_SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(150);
    expect(PLAY_LEGEND_SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(80);
  });

  test('defers detail hydrate after list paint', () => {
    expect(PLAY_LEGEND_DETAIL_DEFER_MS).toBeGreaterThanOrEqual(
      PLAY_LEGEND_SEARCH_DEBOUNCE_MS
    );
    expect(PLAY_LEGEND_DETAIL_DEFER_MS).toBeLessThanOrEqual(300);
  });

  test('pages enough legends for a first paint', () => {
    expect(PLAY_LEGEND_PAGE_SIZE).toBeGreaterThanOrEqual(40);
  });

  test('builds stable query keys for cache hits', () => {
    expect(playLegendListQueryKey('  Jinx  ')).toEqual(playLegendListQueryKey('jinx'));
    expect(playLegendListQueryKey('')).toEqual(playLegendListQueryKey('  '));
    expect(playLegendDetailsQueryKey(['OGN-280a', 'OGN-280'])).toEqual(
      playLegendDetailsQueryKey(['OGN-280', 'OGN-280a'])
    );
  });
});

describe('groupLegendListItems', () => {
  test('keeps only legend rows and merges foil finishes', () => {
    const grouped = groupLegendListItems([
      listItem({
        cardId: '11111111-1111-4111-8111-111111111111',
        name: 'Jinx - Loose Cannon',
        variantNumber: 'OGN-280',
        printings: [
          {
            variantNumber: 'OGN-280',
            variantLabel: 'Standard',
            isFoil: false,
            priceEur: null,
          },
          {
            variantNumber: 'OGN-280',
            variantLabel: 'Foil',
            isFoil: true,
            priceEur: null,
          },
        ],
      }),
      listItem({
        cardId: '22222222-2222-4222-8222-222222222222',
        name: 'Some Unit',
        variantNumber: 'OGN-001',
        type: 'Unit',
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.name).toBe('Jinx - Loose Cannon');
    expect(grouped[0]?.printings.some((p) => p.isFoil)).toBe(true);
  });

  test('keeps alternate arts as separate selectable rows', () => {
    const cardId = '11111111-1111-4111-8111-111111111111';
    const grouped = groupLegendListItems([
      listItem({
        cardId,
        name: 'Jinx - Loose Cannon',
        variantNumber: 'OGN-280',
        printings: [
          {
            variantNumber: 'OGN-280',
            variantLabel: 'Standard',
            isFoil: false,
            priceEur: null,
          },
        ],
      }),
      listItem({
        cardId,
        name: 'Jinx - Loose Cannon',
        variantNumber: 'OGN-280a',
        imageUrl: 'https://cdn.example.com/alt.webp',
        printings: [
          {
            variantNumber: 'OGN-280a',
            variantLabel: 'Overnumbered',
            isFoil: false,
            priceEur: null,
          },
        ],
      }),
    ]);

    expect(grouped.map((row) => row.variantNumber).sort()).toEqual([
      'OGN-280',
      'OGN-280a',
    ]);
  });
});

describe('buildPlayLegendRows', () => {
  test('paints from list payload before details arrive', () => {
    const items = [
      listItem({
        cardId: '11111111-1111-4111-8111-111111111111',
        name: 'Jinx - Loose Cannon',
        variantNumber: 'OGN-280',
      }),
    ];
    const rows = buildPlayLegendRows(items, undefined);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.variantNumber).toBe('OGN-280');
    expect(rows[0]?.imageUrl).toContain('art.webp');
  });

  test('prefers hydrated detail art when batch returns', () => {
    const items = [
      listItem({
        cardId: '11111111-1111-4111-8111-111111111111',
        name: 'Jinx - Loose Cannon',
        variantNumber: 'OGN-280',
      }),
    ];
    const details: CardDetail[] = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Jinx - Loose Cannon',
        type: 'Legend',
        super: null,
        description: '',
        energy: 0,
        might: 0,
        power: 0,
        tags: ['Jinx'],
        colors: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Chaos' }],
        banEffectiveDate: null,
        variants: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            variantNumber: 'OGN-280',
            rarity: 'Rare',
            variantType: 'Standard',
            variantLabel: 'Standard',
            foilMode: 'both',
            imageUrl: 'https://cdn.example.com/detail.webp',
            cardmarketId: null,
            tcgplayerId: null,
            releaseDate: null,
            artist: null,
            prices: [],
          },
        ],
      },
    ];
    const rows = buildPlayLegendRows(items, details);
    expect(rows[0]?.imageUrl).toContain('detail.webp');
  });
});

describe('smooth search display helpers', () => {
  test('only shows spinner when there is nothing painted', () => {
    expect(shouldShowLegendCatalogLoading(true, 0)).toBe(true);
    expect(shouldShowLegendCatalogLoading(true, 3)).toBe(false);
    expect(shouldShowLegendCatalogLoading(false, 0)).toBe(false);
  });

  test('keeps previous legends while a fetch is in flight', () => {
    const previous = [{ id: 'a' }, { id: 'b' }];
    expect(resolveDisplayedLegends([], previous, true)).toEqual(previous);
  });

  test('clears immediately when a settled search returns empty', () => {
    const previous = [{ id: 'a' }];
    expect(resolveDisplayedLegends([], previous, false)).toEqual([]);
  });

  test('prefers fresh results when they arrive', () => {
    const next = [{ id: 'z' }];
    expect(resolveDisplayedLegends(next, [{ id: 'a' }], true)).toEqual(next);
  });
});

describe('playScoreHintClasses', () => {
  test('etches darker ink on light seats', () => {
    const tone = playScoreHintClasses('light');
    expect(tone.textClassName).toContain('text-black');
  });

  test('etches lighter ink on dark seats', () => {
    const tone = playScoreHintClasses('dark');
    expect(tone.textClassName).toContain('text-white');
  });

  test('never returns plate chrome', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tone = playScoreHintClasses(scheme);
      expect(tone).not.toHaveProperty('plateClassName');
      expect(tone).not.toHaveProperty('iconColor');
      expect(Object.keys(tone)).toEqual(['textClassName']);
    }
  });
});
