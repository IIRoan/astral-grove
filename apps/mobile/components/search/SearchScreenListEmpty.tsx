import {
  CardholderIcon,
  CardsIcon,
  CloudOffIcon,
  SearchIcon,
} from '@/components/icons';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { SearchSkeleton } from '@/components/search/SearchSkeleton';
import { SearchEmptyState } from '@/components/search/SearchScreenEmpty';
import type { CatalogFilters } from '@/constants/catalogFilters';
import { catalogFiltersActive } from '@/constants/catalogFilters';
import { isCatalogGridLoading } from '@/lib/catalog-loading';

export interface SearchScreenFetchStatus {
  isSearching: boolean;
  searchPending: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
}

interface SearchScreenListEmptyProps {
  query: string;
  minLength: number;
  fetchStatus: SearchScreenFetchStatus;
  itemsLength: number;
  browseCatalogLoading: boolean;
  featuredFilteredLength: number;
  filteredItemsLength: number;
  view: 'grid' | 'list';
  isList: boolean;
  numColumns: number;
  tileWidth: number;
  compact: boolean;
  filterActive: boolean;
  ownedFilterActive: boolean;
  catalogFilters: CatalogFilters;
}

export function SearchScreenListEmpty({
  query,
  minLength,
  fetchStatus,
  itemsLength,
  browseCatalogLoading,
  featuredFilteredLength,
  filteredItemsLength,
  view,
  isList,
  numColumns,
  tileWidth,
  compact,
  filterActive,
  ownedFilterActive,
  catalogFilters,
}: SearchScreenListEmptyProps) {
  const { isSearching, searchPending, isLoading, isError, isFetching } = fetchStatus;
  const trimmed = query.trim();
  const catalogGridLoading = isCatalogGridLoading({
    isSearching,
    searchPending,
    isLoading,
    isFetching,
    searchItemsLength: itemsLength,
    browseLoading: browseCatalogLoading,
  });

  if (catalogGridLoading) {
    return (
      <SearchSkeleton
        layout={view}
        count={isList ? 8 : numColumns * 2}
        tileWidth={tileWidth}
        compact={compact}
      />
    );
  }

  if (isSearching && isError) {
    return (
      <SearchEmptyState
        icon={CloudOffIcon}
        title="Could not load cards"
        description="Check that the API is running and EXPO_PUBLIC_API_URL is set."
      />
    );
  }

  if (trimmed.length > 0 && trimmed.length < minLength) {
    return (
      <Empty className="mt-14 border-0">
        <EmptyDescription>
          Type at least {minLength} characters to search
        </EmptyDescription>
      </Empty>
    );
  }

  if (isSearching && !searchPending && !isFetching && filteredItemsLength === 0) {
    return (
      <SearchEmptyState
        icon={SearchIcon}
        title={filterActive ? 'No cards match this filter' : 'No cards found'}
        description={
          filterActive
            ? 'Try clearing the filter or a different search'
            : 'Try a different spelling or fewer keywords'
        }
      />
    );
  }

  if (
    !isSearching &&
    !browseCatalogLoading &&
    filterActive &&
    featuredFilteredLength === 0
  ) {
    if (ownedFilterActive) {
      return (
        <SearchEmptyState
          icon={CardholderIcon}
          title={
            catalogFiltersActive({ ...catalogFilters, collection: 'all' })
              ? 'No owned cards match this filter'
              : 'No cards in your collection yet'
          }
          description={
            catalogFiltersActive({ ...catalogFilters, collection: 'all' })
              ? 'Try clearing other filters or search for a specific card'
              : 'Add cards from the catalog or import your collection'
          }
        />
      );
    }

    return (
      <SearchEmptyState
        icon={SearchIcon}
        title="No cards match this filter"
        description="Try clearing the filter or search for a specific card"
      />
    );
  }

  if (trimmed.length === 0) {
    return (
      <SearchEmptyState
        icon={CardsIcon}
        title="Find your cards"
        description="Search by name, variant number, type, or tags"
      />
    );
  }

  return null;
}
