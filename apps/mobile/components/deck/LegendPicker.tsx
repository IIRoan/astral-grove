import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ImageIcon,
  SearchIcon,
  ThemedIcon,
} from '@/components/icons';
import { useCatalogFilterOptions } from '@/components/catalog/CatalogFilterPanels';
import { toggleCatalogFilterValue } from '@/components/catalog/catalogFilterPanels.shared';
import {
  FilterChipGrid,
  FilterOptionChip,
} from '@/components/filters/MobileFilterSheet';
import { DomainIcon } from '@/components/riftbound/CardIcons';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { ListSpacer } from '@/components/ui/list-spacer';
import { AppLoader } from '@/components/ui/app-loader';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import {
  Popover,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import {
  CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS,
  CATALOG_TOOLBAR_LABELED_CONTROL_CLASS,
} from '@/constants/catalogToolbar';
import { useScreenLayout } from '@/components/shell/ScreenLayout';
import { useLegendCatalog } from '@/hooks/useLegendCatalog';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import type { DeckCard } from '@/lib/deck-types';
import { hapticPress } from '@/utils/haptics';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { cn } from '@/lib/utils';

interface LegendPickerProps {
  onSelect: (legend: DeckCard) => void;
  onBack?: () => void;
  paddingBottom?: number;
}

export function LegendPicker({
  onSelect,
  onBack,
  paddingBottom = 0,
}: LegendPickerProps) {
  const { contentWidth } = useScreenLayout();
  const { tileWidth, gap, numColumns } = useResponsiveColumns('grid', {
    measuredWidth: contentWidth,
  });

  const [colors, setColors] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [setMenuOpen, setSetMenuOpen] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const catalogFilters = useMemo(
    () => ({
      colors,
      ...(selectedSet ? { sets: [selectedSet] } : {}),
    }),
    [colors, selectedSet]
  );
  const { query, setQuery, legends, loading, loadingMore, hasNextPage, fetchNextPage } =
    useLegendCatalog(catalogFilters);
  const { colorOptions, setOptions } = useCatalogFilterOptions();
  const setLabel =
    setOptions.find((set) => set.code === selectedSet)?.code ?? 'All sets';
  const setMenuWidth = Math.min(288, Math.max(200, windowWidth - 32));
  const setMenuMaxHeight = Math.min(320, Math.max(180, windowHeight * 0.45));

  const columnWrapperStyle = useMemo(() => ({ gap, marginBottom: gap }), [gap]);

  const listContentStyle = useMemo(
    () => ({ flexGrow: legends.length === 0 ? 1 : undefined }),
    [legends.length]
  );

  const listFooter = useMemo(
    () => (
      <>
        {loadingMore ? (
          <View className="items-center py-4">
            <AppLoader size="sm" />
          </View>
        ) : null}
        <ListSpacer height={paddingBottom} />
      </>
    ),
    [loadingMore, paddingBottom]
  );

  const renderLegendItem = useCallback<ListRenderItem<DeckCard>>(
    ({ item }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${item.name}`}
        style={{ width: tileWidth }}
        className="gap-1.5 active:opacity-90"
        onPress={() => {
          hapticPress();
          onSelect(item);
        }}
      >
        <View
          className={cn(
            'aspect-[5/7] w-full overflow-hidden border border-white/10 bg-background',
            CARD_ART_RADIUS_CLASS
          )}
        >
          {item.imageUrl ? (
            <DeckCardArt
              uri={resolveImageUrl(item.imageUrl)}
              variantNumber={item.variantNumber}
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-card-panel">
              <ThemedIcon icon={ImageIcon} size={20} color="muted-foreground" />
            </View>
          )}
        </View>
        <Text className="text-[12px] font-normal text-foreground" numberOfLines={2}>
          {item.name}
        </Text>
        {item.colors.length > 0 ? (
          <Text className="text-[11px] text-muted-foreground">
            {item.colors.join(' · ')}
          </Text>
        ) : null}
      </Pressable>
    ),
    [onSelect, tileWidth]
  );

  return (
    <View className="min-h-0 flex-1">
      <View className="shrink-0 gap-2 pb-4">
        {onBack ? (
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="size-10 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel"
              onPress={() => {
                hapticPress();
                onBack();
              }}
            >
              <ThemedIcon icon={ChevronLeftIcon} size={22} color="foreground" />
            </Pressable>
            <Text className="text-lg font-normal text-foreground">
              Choose your Legend
            </Text>
          </View>
        ) : (
          <Text className="text-lg font-normal text-foreground">
            Choose your Legend
          </Text>
        )}
        <Text className="text-[13px] leading-snug text-muted-foreground">
          Your Legend sets domain identity, rune colors, and signature rules for the
          entire deck.
        </Text>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search legends"
          autoFocus
        />
        {colorOptions.length > 0 || setOptions.length > 0 ? (
          <View className="flex-row items-start gap-2">
            {colorOptions.length > 0 ? (
              <View className="min-w-0 flex-1 gap-1.5">
                <Text className="text-[11px] font-medium text-muted-foreground">
                  Domains
                </Text>
                <FilterChipGrid>
                  {colorOptions.map((color) => (
                    <FilterOptionChip
                      key={color.id}
                      label={color.name}
                      active={colors.includes(color.name)}
                      onPress={() => {
                        hapticPress();
                        setColors((prev) => toggleCatalogFilterValue(prev, color.name));
                      }}
                      leading={
                        <DomainIcon
                          name={color.name}
                          imageUrl={color.imageUrl}
                          size={18}
                        />
                      }
                    />
                  ))}
                </FilterChipGrid>
              </View>
            ) : null}
            {setOptions.length > 0 ? (
              <View className="shrink-0 gap-1.5">
                <Text className="text-[11px] font-medium text-muted-foreground">
                  Set
                </Text>
                <Popover open={setMenuOpen} onOpenChange={setSetMenuOpen}>
                  <PopoverTrigger asChild>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by set, ${setLabel}`}
                      accessibilityState={{ expanded: setMenuOpen }}
                      className={cn(
                        CATALOG_TOOLBAR_LABELED_CONTROL_CLASS,
                        'min-h-11 min-w-[7.5rem] max-w-[9.5rem] justify-between gap-2 px-3',
                        (setMenuOpen || selectedSet) &&
                          CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS
                      )}
                      onPress={() => {
                        hapticPress();
                      }}
                    >
                      <Text
                        className={cn(
                          'min-w-0 flex-1 text-[13px] font-normal leading-none',
                          setMenuOpen || selectedSet
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                        numberOfLines={1}
                      >
                        {setLabel}
                      </Text>
                      <ThemedIcon
                        icon={setMenuOpen ? ChevronUpIcon : ChevronDownIcon}
                        size={12}
                        color={
                          setMenuOpen || selectedSet ? 'foreground' : 'muted-foreground'
                        }
                      />
                    </Pressable>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverOverlay className="bg-transparent" closeOnPress />
                    <PopoverContent
                      side="bottom"
                      align="end"
                      sideOffset={4}
                      width={setMenuWidth}
                      className="z-50 overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
                      style={{ maxHeight: setMenuMaxHeight }}
                    >
                      <ScrollView
                        style={{ maxHeight: setMenuMaxHeight }}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                      >
                        <Pressable
                          accessibilityRole="menuitem"
                          accessibilityState={{ selected: selectedSet === null }}
                          className="min-h-11 flex-row items-center justify-between rounded-[3px] px-3 py-2.5 active:bg-card-panel"
                          onPress={() => {
                            hapticPress();
                            setSelectedSet(null);
                            setSetMenuOpen(false);
                          }}
                        >
                          <Text className="text-sm text-popover-foreground">
                            All sets
                          </Text>
                          {selectedSet === null ? (
                            <ThemedIcon icon={CheckIcon} size={18} color="foreground" />
                          ) : null}
                        </Pressable>
                        {setOptions.map((set) => {
                          const active = selectedSet === set.code;
                          return (
                            <Pressable
                              key={set.code}
                              accessibilityRole="menuitem"
                              accessibilityLabel={`${set.name} (${set.code})`}
                              accessibilityState={{ selected: active }}
                              className="min-h-11 flex-row items-center justify-between gap-3 rounded-[3px] px-3 py-2.5 active:bg-card-panel"
                              onPress={() => {
                                hapticPress();
                                setSelectedSet(set.code);
                                setSetMenuOpen(false);
                              }}
                            >
                              <View className="min-w-0 flex-1">
                                <Text
                                  className="text-sm text-popover-foreground"
                                  numberOfLines={1}
                                >
                                  {set.name}
                                </Text>
                                <Text className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                  {set.code}
                                </Text>
                              </View>
                              {active ? (
                                <ThemedIcon
                                  icon={CheckIcon}
                                  size={18}
                                  color="foreground"
                                />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </PopoverContent>
                  </PopoverPortal>
                </Popover>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading && legends.length === 0 ? (
        <View className="min-h-0 flex-1 items-center justify-center py-16">
          <AppLoader size="md" />
        </View>
      ) : (
        <FlatList
          key={`legend-grid-${numColumns}`}
          data={legends}
          keyExtractor={(item) => item.variantNumber}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
          contentContainerStyle={listContentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, minHeight: 0 }}
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <ThemedIcon icon={SearchIcon} size={28} color="muted-foreground" />
              <Text className="text-sm text-muted-foreground">
                No legends match your filters
              </Text>
            </View>
          }
          ListFooterComponent={listFooter}
          renderItem={renderLegendItem}
        />
      )}
    </View>
  );
}
