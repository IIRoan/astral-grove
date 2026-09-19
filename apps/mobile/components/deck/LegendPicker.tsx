import { ThemedIcon, ChevronLeftIcon, ImageIcon, SearchIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View, type ListRenderItem } from 'react-native';
import { ListSpacer } from '@/components/ui/list-spacer';
import { AppLoader } from '@/components/ui/app-loader';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { useScreenLayout } from '@/components/shell/ScreenLayout';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { deckCardFromDetail, isLegendCard } from '@/lib/deck-card';
import type { DeckCard } from '@/lib/deck-types';
import { api } from '@/src/api/client';
import { cardQueryKeys } from '@/src/api/queryKeys';
import { useDebounce } from '@/hooks/useDebounce';
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

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 300);

  const cardsQuery = useQuery({
    queryKey: cardQueryKeys.search(debounced || 'type:legend', 60, 'name', 'asc'),
    queryFn: () =>
      api.listCards({
        q: debounced || undefined,
        types: 'Legend',
        limit: 60,
        page: 1,
        sortBy: 'name',
        dir: 'asc',
      }),
    staleTime: 60_000,
  });

  const listItems = useMemo(
    () =>
      (cardsQuery.data?.data ?? []).filter(
        (item) => item.type.toLowerCase() === 'legend'
      ),
    [cardsQuery.data?.data]
  );
  const variantNumbers = useMemo(
    () => listItems.map((item) => item.variantNumber),
    [listItems]
  );

  const detailsQuery = useQuery({
    queryKey: ['legend-picker-details', [...variantNumbers].sort().join(',')],
    queryFn: () => api.batchCards(variantNumbers),
    enabled: variantNumbers.length > 0,
    staleTime: 60_000,
  });

  const legends = useMemo(() => {
    const details = detailsQuery.data?.data ?? [];
    if (!details.length) return [];

    const detailByVariant = new Map<string, (typeof details)[number]>();
    for (const card of details) {
      for (const variant of card.variants) {
        detailByVariant.set(variant.variantNumber, card);
      }
    }

    const results: DeckCard[] = [];
    for (const item of listItems) {
      const detail = detailByVariant.get(item.variantNumber);
      if (!detail) continue;
      const card = deckCardFromDetail(detail, item.variantNumber);
      if (!isLegendCard(card)) continue;
      results.push(card);
    }
    return results;
  }, [detailsQuery.data, listItems]);

  const loading =
    cardsQuery.isLoading || (variantNumbers.length > 0 && detailsQuery.isLoading);

  const columnWrapperStyle = useMemo(() => ({ gap, marginBottom: gap }), [gap]);

  const listContentStyle = useMemo(
    () => ({ flexGrow: legends.length === 0 ? 1 : undefined }),
    [legends.length]
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
      </View>

      {loading && legends.length === 0 ? (
        <View className="min-h-0 flex-1 items-center justify-center py-16">
          <AppLoader size="md" />
        </View>
      ) : (
        <FlatList
          // RN FlatList cannot change numColumns on the fly (rotation / Split View resize).
          key={`legend-grid-${numColumns}`}
          data={legends}
          keyExtractor={(item) => item.variantNumber}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
          contentContainerStyle={listContentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, minHeight: 0 }}
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <ThemedIcon icon={SearchIcon} size={28} color="muted-foreground" />
              <Text className="text-sm text-muted-foreground">
                No legends match your search
              </Text>
            </View>
          }
          ListFooterComponent={<ListSpacer height={paddingBottom} />}
          renderItem={renderLegendItem}
        />
      )}
    </View>
  );
}
