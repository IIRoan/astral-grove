import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DECK_BROWSE_FILTERS,
  deckBrowseSetNameLookup,
  deckBrowseSetOptionsFromFilters,
  sanitizeDeckBrowseFilters,
  type DeckBrowseFilters,
  type DeckBrowseSetOption,
} from '@/constants/deckBrowse';
import { filtersQueryUiState, useFiltersData } from '@/hooks/useFiltersData';

export function useDeckBrowseFilterOptions(): {
  isLoading: boolean;
  setOptions: DeckBrowseSetOption[];
  setNameByCode: Map<string, string>;
} {
  const filtersQuery = useFiltersData();

  const setOptions = useMemo(
    () => deckBrowseSetOptionsFromFilters(filtersQuery.data?.sets),
    [filtersQuery.data?.sets]
  );

  const setNameByCode = useMemo(
    () => deckBrowseSetNameLookup(setOptions),
    [setOptions]
  );

  const { isLoading } = filtersQueryUiState(filtersQuery);

  return {
    isLoading,
    setOptions,
    setNameByCode,
  };
}

export function useDeckBrowseFilters(): [
  DeckBrowseFilters,
  (filters: DeckBrowseFilters) => void,
] {
  const [filters, setFilters] = useState<DeckBrowseFilters>(
    DEFAULT_DECK_BROWSE_FILTERS
  );
  const { setOptions } = useDeckBrowseFilterOptions();
  const availableSetCodes = useMemo(
    () => setOptions.map((option) => option.code),
    [setOptions]
  );

  useEffect(() => {
    if (availableSetCodes.length === 0) return;
    setFilters((current) => sanitizeDeckBrowseFilters(current, availableSetCodes));
  }, [availableSetCodes]);

  const setFiltersSafe = useCallback(
    (next: DeckBrowseFilters) => {
      setFilters(
        availableSetCodes.length > 0
          ? sanitizeDeckBrowseFilters(next, availableSetCodes)
          : next
      );
    },
    [availableSetCodes]
  );

  return [filters, setFiltersSafe];
}
