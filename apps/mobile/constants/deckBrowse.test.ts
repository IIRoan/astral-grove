import { describe, expect, test } from 'bun:test';
import type { FilterSnapshot } from '@riftbound/contracts';
import {
  buildDeckBrowseFilterChips,
  deckBrowseFiltersToQuery,
  deckBrowseSetNameLookup,
  deckBrowseSetOptionsFromFilters,
  DEFAULT_DECK_BROWSE_FILTERS,
  formatDeckBrowseSetSelection,
  sanitizeDeckBrowseFilters,
} from '@/constants/deckBrowse';

const sampleFilterSets: FilterSnapshot['sets'] = [
  { id: 'ven', code: 'VEN', name: 'Vendetta', count: 30, printCount: 30 },
  { id: 'ogn', code: 'OGN', name: 'Origins', count: 354, printCount: 544 },
  {
    id: 'sfd-nn',
    code: 'SFD-NN',
    name: 'Spiritforged | Nexus Night',
    count: 0,
    printCount: 33,
  },
  { id: 'empty', code: 'EMP', name: 'Empty Set', count: 0, printCount: 0 },
];

describe('deckBrowseSetOptionsFromFilters', () => {
  test('maps live filter sets and drops empty entries', () => {
    expect(deckBrowseSetOptionsFromFilters(sampleFilterSets)).toEqual([
      { code: 'VEN', name: 'Vendetta', count: 30 },
      { code: 'OGN', name: 'Origins', count: 544 },
      { code: 'SFD-NN', name: 'Spiritforged | Nexus Night', count: 33 },
    ]);
  });

  test('normalizes missing set codes from filter ids', () => {
    expect(
      deckBrowseSetOptionsFromFilters([
        { id: 'wrld25', name: 'Worlds Bundle 2025', count: 4 },
      ])
    ).toEqual([{ code: 'WRLD25', name: 'Worlds Bundle 2025', count: 4 }]);
  });
});

describe('sanitizeDeckBrowseFilters', () => {
  test('removes stale set codes after catalog changes', () => {
    const filters = {
      ...DEFAULT_DECK_BROWSE_FILTERS,
      sets: ['VEN', 'RETIRED'],
    };

    expect(sanitizeDeckBrowseFilters(filters, ['VEN', 'OGN'])).toEqual({
      ...DEFAULT_DECK_BROWSE_FILTERS,
      sets: ['VEN'],
    });
  });

  test('returns the same object when nothing changes', () => {
    const filters = {
      ...DEFAULT_DECK_BROWSE_FILTERS,
      sets: ['OGN'],
    };

    expect(sanitizeDeckBrowseFilters(filters, ['OGN', 'VEN'])).toBe(filters);
  });
});

describe('formatDeckBrowseSetSelection', () => {
  test('uses set names when available', () => {
    const lookup = deckBrowseSetNameLookup([
      { code: 'VEN', name: 'Vendetta', count: 30 },
      { code: 'OGN', name: 'Origins', count: 544 },
    ]);

    expect(formatDeckBrowseSetSelection(['VEN', 'OGN'], lookup)).toBe(
      'Vendetta, Origins'
    );
    expect(formatDeckBrowseSetSelection(['UNKNOWN'], lookup)).toBe('UNKNOWN');
  });
});

describe('buildDeckBrowseFilterChips', () => {
  test('builds readable set chip labels from the live lookup', () => {
    const lookup = deckBrowseSetNameLookup([
      { code: 'VEN', name: 'Vendetta', count: 30 },
      { code: 'OGN', name: 'Origins', count: 544 },
    ]);

    const chips = buildDeckBrowseFilterChips(
      {
        ...DEFAULT_DECK_BROWSE_FILTERS,
        legend: 'Ahri, Nine-Tailed Fox',
        sets: ['VEN', 'OGN'],
        hasVideo: true,
      },
      lookup
    );

    expect(chips.map((chip) => chip.label)).toEqual([
      'Ahri, Nine-Tailed Fox',
      'Sets: Vendetta, Origins',
      'Has video',
    ]);
    expect(
      chips[1]?.applyClear({ ...DEFAULT_DECK_BROWSE_FILTERS, sets: ['VEN', 'OGN'] })
    ).toEqual(DEFAULT_DECK_BROWSE_FILTERS);
  });
});

describe('deckBrowseFiltersToQuery', () => {
  test('maps active filters to API query params', () => {
    expect(
      deckBrowseFiltersToQuery({
        ...DEFAULT_DECK_BROWSE_FILTERS,
        legend: 'Vex, Empress of the Void',
        sets: ['OGN', 'SFD'],
        isLegal: true,
        hasGuide: true,
        hasVideo: false,
        hasMatchups: true,
      })
    ).toEqual({
      legend: 'Vex, Empress of the Void',
      sets: 'OGN,SFD',
      isLegal: true,
      hasGuide: true,
      hasMatchups: true,
    });
  });

  test('omits inactive filters', () => {
    expect(deckBrowseFiltersToQuery(DEFAULT_DECK_BROWSE_FILTERS)).toEqual({});
  });
});
