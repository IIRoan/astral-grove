import { describe, expect, test } from 'bun:test';
import {
  isCatalogGridLoading,
  resolveCatalogDisplayItems,
} from '@/lib/catalog-loading';

describe('isCatalogGridLoading', () => {
  test('returns true while search is pending', () => {
    expect(
      isCatalogGridLoading({
        isSearching: true,
        searchPending: true,
        isLoading: false,
        isFetching: false,
        searchItemsLength: 0,
        browseLoading: false,
      })
    ).toBe(true);
  });

  test('returns true while browse catalog is loading', () => {
    expect(
      isCatalogGridLoading({
        isSearching: false,
        searchPending: false,
        isLoading: false,
        isFetching: false,
        searchItemsLength: 0,
        browseLoading: true,
      })
    ).toBe(true);
  });

  test('returns false when search results are already visible', () => {
    expect(
      isCatalogGridLoading({
        isSearching: true,
        searchPending: false,
        isLoading: false,
        isFetching: true,
        searchItemsLength: 12,
        browseLoading: false,
      })
    ).toBe(false);
  });
});

describe('resolveCatalogDisplayItems', () => {
  const browse = ['browse-a', 'browse-b'];
  const search = ['soraka'];
  const previousSearch = ['ahri', 'akali'];

  test('returns browse items when not searching', () => {
    expect(
      resolveCatalogDisplayItems({
        hasSearchInput: false,
        searchItems: search,
        browseItems: browse,
        searchPending: false,
        isLoading: false,
        isFetching: false,
        searchItemsLength: 1,
      })
    ).toEqual(browse);
  });

  test('keeps previous search hits while the draft is still debouncing', () => {
    expect(
      resolveCatalogDisplayItems({
        hasSearchInput: true,
        searchItems: previousSearch,
        browseItems: browse,
        searchPending: true,
        isLoading: false,
        isFetching: false,
        searchItemsLength: previousSearch.length,
      })
    ).toEqual(previousSearch);
  });

  test('shows a skeleton-empty list while the first search page is in flight', () => {
    expect(
      resolveCatalogDisplayItems({
        hasSearchInput: true,
        searchItems: [],
        browseItems: browse,
        searchPending: false,
        isLoading: true,
        isFetching: false,
        searchItemsLength: 0,
      })
    ).toEqual([]);
  });

  test('switches to search hits once they arrive', () => {
    expect(
      resolveCatalogDisplayItems({
        hasSearchInput: true,
        searchItems: search,
        browseItems: browse,
        searchPending: false,
        isLoading: false,
        isFetching: false,
        searchItemsLength: 1,
      })
    ).toEqual(search);
  });

  test('shows an empty search result after the query settles', () => {
    expect(
      resolveCatalogDisplayItems({
        hasSearchInput: true,
        searchItems: [],
        browseItems: browse,
        searchPending: false,
        isLoading: false,
        isFetching: false,
        searchItemsLength: 0,
      })
    ).toEqual([]);
  });
});
