import { describe, expect, test } from 'bun:test';
import {
  toggleCatalogFilterValue,
  toggleCatalogStatFilter,
} from '@/components/catalog/catalogFilterPanels.shared';
import { DEFAULT_CATALOG_FILTERS } from '@/constants/catalogFilters';

describe('toggleCatalogFilterValue', () => {
  test('adds and removes values like color chips', () => {
    expect(toggleCatalogFilterValue(['Calm'], 'Chaos')).toEqual(['Calm', 'Chaos']);
    expect(toggleCatalogFilterValue(['Calm', 'Chaos'], 'Calm')).toEqual(['Chaos']);
  });
});

describe('toggleCatalogStatFilter', () => {
  test('sets energy when none is selected', () => {
    expect(toggleCatalogStatFilter(DEFAULT_CATALOG_FILTERS, 'energy', 5)).toEqual({
      ...DEFAULT_CATALOG_FILTERS,
      energy: 5,
    });
  });

  test('clears energy when pressing the active value again', () => {
    const withEnergy = { ...DEFAULT_CATALOG_FILTERS, energy: 5 };
    const cleared = toggleCatalogStatFilter(withEnergy, 'energy', 5);
    expect(cleared.energy).toBeUndefined();
    expect('energy' in cleared).toBe(false);
  });

  test('replaces energy when selecting a different value', () => {
    const withEnergy = { ...DEFAULT_CATALOG_FILTERS, energy: 5 };
    expect(toggleCatalogStatFilter(withEnergy, 'energy', 3).energy).toBe(3);
  });

  test('clears power and might the same way', () => {
    expect(
      toggleCatalogStatFilter({ ...DEFAULT_CATALOG_FILTERS, power: 2 }, 'power', 2).power
    ).toBeUndefined();
    expect(
      toggleCatalogStatFilter({ ...DEFAULT_CATALOG_FILTERS, might: 7 }, 'might', 7).might
    ).toBeUndefined();
  });
});
