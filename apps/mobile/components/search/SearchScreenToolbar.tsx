import { View } from 'react-native';
import { CatalogActionBar } from '@/components/catalog/CatalogActionBar';
import { CatalogDesktopToolbar } from '@/components/catalog/CatalogDesktopToolbar';
import { CatalogActiveFilterChips } from '@/components/catalog/FilterSheet';
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
}: SearchScreenToolbarProps) {
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

      {isMobile ? (
        <>
          <CatalogActionBar
            activeSort={catalogSort}
            onSortPress={onSortPress}
            filters={catalogFilters}
            onFilterPress={onFilterPress}
            collection={catalogFilters.collection}
            onCollectionChange={(collection) =>
              onFiltersChange({ ...catalogFilters, collection })
            }
            simpleAdd={catalogFilters.simpleAdd}
            onSimpleAddChange={(simpleAdd) =>
              onFiltersChange({ ...catalogFilters, simpleAdd })
            }
          />
          {filterActive ? (
            <CatalogActiveFilterChips
              filters={catalogFilters}
              onFiltersChange={onFiltersChange}
            />
          ) : null}
        </>
      ) : (
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
      )}
    </View>
  );
}
