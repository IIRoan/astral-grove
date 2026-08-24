import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppLoader } from '@/components/ui/app-loader';
import {
  FilterChipGrid,
  FilterOptionChip,
} from '@/components/filters/MobileFilterSheet';
import { FilterToggleRow } from '@/components/filters/FilterPrimitives';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import { type DeckBrowseFilters } from '@/constants/deckBrowse';
import { useDebounce } from '@/hooks/useDebounce';
import { useDeckBrowseFilterOptions } from '@/hooks/useDeckBrowseFilters';
import { type DeckBrowseFilterSegment } from '@/lib/deck-browse';
import { mapFilter, toMembershipSet } from '@/lib/iteration';
import { api } from '@/src/api/client';
import { cardQueryKeys } from '@/src/api/queryKeys';

export type DeckBrowseFilterPresentation = 'list' | 'mobile';

interface DeckBrowseFilterSegmentPanelProps {
  segment: DeckBrowseFilterSegment;
  filters: DeckBrowseFilters;
  onFiltersChange: (filters: DeckBrowseFilters) => void;
  enabled?: boolean;
  compact?: boolean;
  presentation?: DeckBrowseFilterPresentation;
}

export function DeckBrowseFilterSegmentPanel({
  segment,
  filters,
  onFiltersChange,
  enabled = true,
  compact = false,
  presentation = 'list',
}: DeckBrowseFilterSegmentPanelProps) {
  const [legendQuery, setLegendQuery] = useState('');
  const debouncedLegendQuery = useDebounce(legendQuery.trim(), 300);
  const isMobile = presentation === 'mobile';
  const { isLoading: setOptionsLoading, setOptions } = useDeckBrowseFilterOptions();

  const legendsQuery = useQuery({
    queryKey: cardQueryKeys.search(
      debouncedLegendQuery || 'type:legend',
      50,
      'name',
      'asc'
    ),
    queryFn: () =>
      api.listCards({
        q: debouncedLegendQuery || undefined,
        types: 'Legend',
        limit: 50,
        page: 1,
        sortBy: 'name',
        dir: 'asc',
      }),
    enabled: enabled && segment === 'legends',
    staleTime: 60_000,
  });

  const legendOptions = useMemo(
    () =>
      mapFilter(
        legendsQuery.data?.data ?? [],
        (item) => item.type.toLowerCase() === 'legend',
        (item) => item.name
      ),
    [legendsQuery.data?.data]
  );

  const selectedSets = useMemo(() => toMembershipSet(filters.sets), [filters.sets]);

  const update = (patch: Partial<DeckBrowseFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const toggleSet = (code: string) => {
    const next = filters.sets.includes(code)
      ? filters.sets.filter((value) => value !== code)
      : [...filters.sets, code];
    update({ sets: next });
  };

  switch (segment) {
    case 'legends':
      return (
        <View className="gap-2">
          <SearchInput
            value={legendQuery}
            onChangeText={setLegendQuery}
            placeholder="Search legends"
            accessibilityLabel="Search legends"
            className="min-h-11 rounded-[3px] border-border bg-card"
          />
          {filters.legend ? (
            isMobile ? (
              <FilterChipGrid>
                <FilterOptionChip
                  label={filters.legend}
                  active
                  onPress={() => update({ legend: undefined })}
                />
              </FilterChipGrid>
            ) : (
              <FilterToggleRow
                label={filters.legend}
                subtitle="Selected legend"
                active
                onPress={() => update({ legend: undefined })}
                compact={compact}
              />
            )
          ) : null}
          {legendsQuery.isLoading ? (
            <View className="items-center py-8">
              <AppLoader size="md" />
            </View>
          ) : legendOptions.length === 0 ? (
            <Text className="py-6 text-center text-sm text-muted-foreground">
              No legends match your search.
            </Text>
          ) : isMobile ? (
            <FilterChipGrid>
              {legendOptions.map((name) => (
                <FilterOptionChip
                  key={name}
                  label={name}
                  active={filters.legend === name}
                  onPress={() =>
                    update({ legend: filters.legend === name ? undefined : name })
                  }
                />
              ))}
            </FilterChipGrid>
          ) : (
            legendOptions.map((name) => (
              <FilterToggleRow
                key={name}
                label={name}
                active={filters.legend === name}
                onPress={() =>
                  update({ legend: filters.legend === name ? undefined : name })
                }
                compact={compact}
              />
            ))
          )}
        </View>
      );
    case 'sets':
      if (setOptionsLoading) {
        return (
          <View className="items-center py-8">
            <AppLoader size="md" />
          </View>
        );
      }
      if (setOptions.length === 0) {
        return (
          <Text className="py-6 text-center text-sm text-muted-foreground">
            No set filters available.
          </Text>
        );
      }
      if (isMobile) {
        return (
          <FilterChipGrid>
            {setOptions.map((set) => (
              <FilterOptionChip
                key={set.code}
                label={set.code}
                active={selectedSets.has(set.code)}
                onPress={() => toggleSet(set.code)}
                accessibilityLabel={`${set.name} (${set.code})`}
              />
            ))}
          </FilterChipGrid>
        );
      }
      return (
        <View className="gap-0.5">
          {setOptions.map((set) => (
            <FilterToggleRow
              key={set.code}
              label={set.name}
              subtitle={`${set.code} · ${set.count.toLocaleString()} printings`}
              active={selectedSets.has(set.code)}
              onPress={() => toggleSet(set.code)}
              compact={compact}
            />
          ))}
        </View>
      );
    case 'legality':
      if (isMobile) {
        return (
          <FilterChipGrid>
            <FilterOptionChip
              label="All"
              active={filters.isLegal === undefined}
              onPress={() => update({ isLegal: undefined })}
            />
            <FilterOptionChip
              label="Legal"
              active={filters.isLegal === true}
              onPress={() =>
                update({ isLegal: filters.isLegal === true ? undefined : true })
              }
            />
            <FilterOptionChip
              label="Not legal"
              active={filters.isLegal === false}
              onPress={() =>
                update({ isLegal: filters.isLegal === false ? undefined : false })
              }
            />
          </FilterChipGrid>
        );
      }
      return (
        <View className="gap-0.5">
          <FilterToggleRow
            label="All decks"
            subtitle="No legality filter"
            active={filters.isLegal === undefined}
            onPress={() => update({ isLegal: undefined })}
            compact={compact}
          />
          <FilterToggleRow
            label="Legal only"
            subtitle="Tournament-legal decklists"
            active={filters.isLegal === true}
            onPress={() =>
              update({ isLegal: filters.isLegal === true ? undefined : true })
            }
            compact={compact}
          />
          <FilterToggleRow
            label="Not legal"
            subtitle="Contains banned or restricted cards"
            active={filters.isLegal === false}
            onPress={() =>
              update({ isLegal: filters.isLegal === false ? undefined : false })
            }
            compact={compact}
          />
        </View>
      );
    case 'content':
      if (isMobile) {
        return (
          <FilterChipGrid>
            <FilterOptionChip
              label="Guide"
              active={filters.hasGuide}
              onPress={() => update({ hasGuide: !filters.hasGuide })}
            />
            <FilterOptionChip
              label="Video"
              active={filters.hasVideo}
              onPress={() => update({ hasVideo: !filters.hasVideo })}
            />
            <FilterOptionChip
              label="Matchups"
              active={filters.hasMatchups}
              onPress={() => update({ hasMatchups: !filters.hasMatchups })}
            />
          </FilterChipGrid>
        );
      }
      return (
        <View className="gap-0.5">
          <FilterToggleRow
            label="Has guide"
            subtitle="Deck includes a written guide"
            active={filters.hasGuide}
            onPress={() => update({ hasGuide: !filters.hasGuide })}
            compact={compact}
          />
          <FilterToggleRow
            label="Has video"
            subtitle="Deck includes a video link"
            active={filters.hasVideo}
            onPress={() => update({ hasVideo: !filters.hasVideo })}
            compact={compact}
          />
          <FilterToggleRow
            label="Has matchups"
            subtitle="Deck includes matchup notes"
            active={filters.hasMatchups}
            onPress={() => update({ hasMatchups: !filters.hasMatchups })}
            compact={compact}
          />
        </View>
      );
    default:
      return null;
  }
}
