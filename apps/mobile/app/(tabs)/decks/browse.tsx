import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  DeckBrowseActiveFilterChips,
  DeckBrowseFilterSheet,
  DeckBrowseFilterTrigger,
} from '@/components/deck/DeckBrowseFilterSheet';
import { DeckBrowseDesktopFilterBar } from '@/components/deck/DeckBrowseDesktopFilterBar';
import {
  DeckBrowseSortSheet,
  DeckBrowseSortTrigger,
} from '@/components/deck/DeckBrowseSortSheet';
import { DecksListScreen } from '@/components/deck/DecksListScreen';
import {
  DEFAULT_DECK_BROWSE_SORT,
  deckBrowseFiltersActive,
  type DeckBrowseSort,
} from '@/constants/deckBrowse';
import { useDeckBrowseFilters } from '@/hooks/useDeckBrowseFilters';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useDebounce } from '@/hooks/useDebounce';
import { useImportedDecksBrowse } from '@/hooks/useDecks';

export default function BrowseDecksScreen() {
  const isMobile = useMobileLayout();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DeckBrowseSort>(DEFAULT_DECK_BROWSE_SORT);
  const [filters, setFilters] = useDeckBrowseFilters();
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  const browseQuery = useImportedDecksBrowse({
    q: debouncedQuery.trim() || undefined,
    sort,
    filters,
  });

  const decks = useMemo(
    () => browseQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [browseQuery.data?.pages]
  );

  const hasActiveFilters =
    deckBrowseFiltersActive(filters) || debouncedQuery.trim().length > 0;

  return (
    <>
      <DecksListScreen
        variant="browse"
        title="Browse decks"
        subtitle="Public decklists from Piltover Archive"
        searchPlaceholder="Search decks, legends, or tags"
        query={query}
        onQueryChange={setQuery}
        decksQuery={{
          data: decks,
          isLoading: browseQuery.isLoading && !browseQuery.data,
          isFetching: browseQuery.isFetching,
          isError: browseQuery.isError,
          refetch: () => void browseQuery.refetch(),
        }}
        emptyTitle="No decks found"
        emptyDescription={
          hasActiveFilters
            ? 'Try a different search term or adjust your filters.'
            : 'Public decks will appear here when Piltover Archive is reachable.'
        }
        browseToolbar={
          <View className="gap-2.5">
            {isMobile ? (
              <View className="flex-row items-stretch gap-2">
                <View className="min-w-0 flex-1">
                  <DeckBrowseSortTrigger
                    activeSort={sort}
                    onPress={() => setSortOpen(true)}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <DeckBrowseFilterTrigger
                    filters={filters}
                    onPress={() => setFilterOpen(true)}
                  />
                </View>
              </View>
            ) : (
              <View className="flex-row items-start gap-3">
                <View className="min-w-0 flex-1">
                  <DeckBrowseDesktopFilterBar
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                </View>
                <View className="shrink-0">
                  <DeckBrowseSortTrigger
                    activeSort={sort}
                    onPress={() => setSortOpen(true)}
                  />
                </View>
              </View>
            )}
            <DeckBrowseActiveFilterChips
              filters={filters}
              onFiltersChange={setFilters}
            />
          </View>
        }
        infiniteScroll={{
          hasNextPage: browseQuery.hasNextPage ?? false,
          isFetchingNextPage: browseQuery.isFetchingNextPage,
          fetchNextPage: () => void browseQuery.fetchNextPage(),
        }}
      />

      <DeckBrowseSortSheet
        visible={sortOpen}
        activeSort={sort}
        onClose={() => setSortOpen(false)}
        onSortChange={setSort}
      />
      {isMobile ? (
        <DeckBrowseFilterSheet
          visible={filterOpen}
          filters={filters}
          onClose={() => setFilterOpen(false)}
          onFiltersChange={setFilters}
        />
      ) : null}
    </>
  );
}
