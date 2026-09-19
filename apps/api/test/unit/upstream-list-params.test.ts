import { describe, expect, test } from 'bun:test';
import type { CardsListQuery } from '@riftbound/contracts';
import {
  buildUpstreamListParams,
  maxUpstreamBackfillPages,
  resolveUpstreamReconcileMode,
  upstreamCheckKey,
  upstreamTotalsBroaderThanLocal,
} from '../../src/lib/upstream-list-params.js';

const baseQuery: CardsListQuery = {
  page: 1,
  limit: 40,
  sortBy: 'name',
  dir: 'asc',
};

describe('buildUpstreamListParams', () => {
  test('maps super to upstream supertypes', () => {
    expect(
      buildUpstreamListParams({
        ...baseQuery,
        types: 'Unit',
        super: 'Champion',
      })
    ).toEqual({
      page: 1,
      limit: 40,
      sortBy: 'name',
      dir: 'asc',
      types: 'Unit',
      supertypes: 'Champion',
    });
  });

  test('includes text search and battlefield filters', () => {
    expect(
      buildUpstreamListParams({
        ...baseQuery,
        q: 'flame',
        types: 'Battlefield',
      })
    ).toMatchObject({
      q: 'flame',
      types: 'Battlefield',
    });
  });

  test('passes colors for default colorMode all', () => {
    expect(
      buildUpstreamListParams({
        ...baseQuery,
        colors: 'Mind,Order',
        colorMode: 'all',
      }).colors
    ).toBe('Mind,Order');
  });

  test('omits colors for within mode so deck identity pools are not under-backfilled', () => {
    expect(
      buildUpstreamListParams({
        ...baseQuery,
        types: 'Unit,Gear,Spell',
        colors: 'Mind,Order',
        colorMode: 'within',
      })
    ).toEqual({
      page: 1,
      limit: 40,
      sortBy: 'name',
      dir: 'asc',
      types: 'Unit,Gear,Spell',
    });
  });
});

describe('upstreamCheckKey', () => {
  test('differentiates catalog filters', () => {
    const battlefield = upstreamCheckKey({ ...baseQuery, types: 'Battlefield' });
    const champion = upstreamCheckKey({
      ...baseQuery,
      types: 'Unit',
      super: 'Champion',
    });
    expect(battlefield).not.toBe(champion);
  });
});

describe('resolveUpstreamReconcileMode', () => {
  test('syncs when filtered browse returns no local rows', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, types: 'Battlefield' },
        { items: [], total: 0 },
        false
      )
    ).toBe('sync');
  });

  test('syncs empty local even when upstream was previously checked', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, q: 'Insightful Investigator' },
        { items: [], total: 0 },
        true
      )
    ).toBe('sync');
  });

  test('syncs text search hits so upstream can fill gaps before respond', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, q: 'vi' },
        { items: [{ id: '1' }], total: 10 },
        false
      )
    ).toBe('sync');
  });

  test('skips non-empty browse when upstream was already checked', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, types: 'Battlefield' },
        { items: [{ id: '1' }], total: 40 },
        true
      )
    ).toBe('skip');
  });

  test('syncs first-page browse so partial catalogs backfill from upstream', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, page: 1, types: 'Battlefield' },
        { items: [{ id: '1' }], total: 40 },
        false
      )
    ).toBe('sync');
  });

  test('skips later browse pages when local already has hits', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, page: 2, types: 'Battlefield' },
        { items: [{ id: '1' }], total: 40 },
        false
      )
    ).toBe('skip');
  });

  test('skips already-checked text search when local already has hits', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, q: 'vi' },
        { items: [{ id: '1' }], total: 10 },
        true
      )
    ).toBe('skip');
  });

  test('syncs deck-builder type filters on page 1 so missing legends backfill', () => {
    expect(
      resolveUpstreamReconcileMode(
        { ...baseQuery, page: 1, types: 'Legend' },
        { items: [{ id: 'legend-1' }], total: 12 },
        false
      )
    ).toBe('sync');
  });
});

describe('maxUpstreamBackfillPages', () => {
  test('allows multi-page text search backfill for alternate arts', () => {
    expect(maxUpstreamBackfillPages({ ...baseQuery, q: 'ahri' })).toBe(20);
  });

  test('allows deep browse backfill for deck-builder identity pools', () => {
    expect(
      maxUpstreamBackfillPages({
        ...baseQuery,
        types: 'Unit,Gear,Spell',
        colors: 'Mind,Order',
        colorMode: 'within',
      })
    ).toBe(100);
  });
});

describe('upstreamTotalsBroaderThanLocal', () => {
  test('false for plain name sort', () => {
    expect(upstreamTotalsBroaderThanLocal(baseQuery)).toBe(false);
  });

  test('true for within color mode', () => {
    expect(
      upstreamTotalsBroaderThanLocal({
        ...baseQuery,
        colors: 'Mind,Order',
        colorMode: 'within',
      })
    ).toBe(true);
  });

  test('true for energy sort (local drops legend/battlefield)', () => {
    expect(upstreamTotalsBroaderThanLocal({ ...baseQuery, sortBy: 'energy' })).toBe(
      true
    );
  });

  test('true for energy min/max filters', () => {
    expect(upstreamTotalsBroaderThanLocal({ ...baseQuery, energyMin: 1 })).toBe(true);
    expect(upstreamTotalsBroaderThanLocal({ ...baseQuery, energyMax: 3 })).toBe(true);
  });
});
