import { View } from 'react-native';
import { CatalogDesktopToolbar } from '@/components/catalog/CatalogDesktopToolbar';
import {
  CatalogActiveFilterChips,
  CatalogFilterTrigger,
} from '@/components/catalog/FilterSheet';
import { SortTrigger } from '@/components/catalog/SortSheet';
import { SearchBar } from '@/components/search/SearchBar';
import type { CatalogSort } from '@/constants/catalogSort';
import type { CatalogFilters } from '@/constants/catalogFilters';

interface SearchScreenToolbarProps {
  pageMaxWidth?: number;
  query: string;
  onQueryChange: (text: string) => void;
  onClearSearch: () => void;
  onActiveSearchQueryChange: (query: string) => void;
  searchLoading: boolean;
  onSubmitSearch: () => void;
  isMobile: boolean;
  filterActive: boolean;
  catalogFilters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  catalogSort: CatalogSort;
  onSortPress: () => void;
  onFilterPress: () => void;
  sortOpen: boolean;
  filterOpen: boolean;
}

export function SearchScreenToolbar({
  pageMaxWidth,
  query,
  onQueryChange,
  onClearSearch,
  onActiveSearchQueryChange,
  searchLoading,
  onSubmitSearch,
  isMobile,
  filterActive,
  catalogFilters,
  onFiltersChange,
  catalogSort,
  onSortPress,
  onFilterPress,
  sortOpen,
  filterOpen,
}: SearchScreenToolbarProps) {
  if (isMobile) {
    return (
      <View className="w-full gap-2 pb-2" style={{ maxWidth: pageMaxWidth }}>
        <View className="w-full flex-row items-center gap-1.5">
          <View className="min-w-0 flex-1">
            <SearchBar
              value={query}
              onChangeText={onQueryChange}
              onClear={onClearSearch}
              onActiveQueryChange={onActiveSearchQueryChange}
              isLoading={searchLoading}
              placeholder="Search cards…"
              onSubmitEditing={onSubmitSearch}
            />
          </View>
          <SortTrigger activeSort={catalogSort} onPress={onSortPress} mobile iconOnly open={sortOpen} />
          <CatalogFilterTrigger
            filters={catalogFilters}
            onPress={onFilterPress}
            compact
            mobile
            open={filterOpen}
          />
        </View>

        {filterActive ? (
          <CatalogActiveFilterChips
            filters={catalogFilters}
            onFiltersChange={onFiltersChange}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="w-full gap-1.5 pb-2" style={{ maxWidth: pageMaxWidth }}>
      <SearchBar
        value={query}
        onChangeText={onQueryChange}
        onClear={onClearSearch}
        onActiveQueryChange={onActiveSearchQueryChange}
        isLoading={searchLoading}
        placeholder="Search cards, artists, tags, or set numbers"
        onSubmitEditing={onSubmitSearch}
      />

      <CatalogDesktopToolbar
        filters={catalogFilters}
        onFiltersChange={onFiltersChange}
        filterActive={filterActive}
        activeSort={catalogSort}
        onSortPress={onSortPress}
        collection={catalogFilters.collection}
        onCollectionChange={(collection) =>
          onFiltersChange({ ...catalogFilters, collection })
        }
        simpleAdd={catalogFilters.simpleAdd}
        onSimpleAddChange={(simpleAdd) =>
          onFiltersChange({ ...catalogFilters, simpleAdd })
        }
      />
    </View>
  );
}
