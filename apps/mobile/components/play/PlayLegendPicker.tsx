import { ThemedIcon, ImageIcon, SearchIcon } from '@/components/icons';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { AppLoader } from '@/components/ui/app-loader';
import { Button, ButtonText } from '@/components/ui/button';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { useLegendCatalog } from '@/hooks/useLegendCatalog';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import type { SeatLegend } from '@/lib/score-tracker';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { hapticPress } from '@/utils/haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
} from 'react-native';

type PlayLegendPickerProps = {
  selectedVariantNumber?: string | null;
  onSelect: (legend: SeatLegend) => void;
  onClear?: () => void;
};

type LegendCatalogItem = ReturnType<typeof useLegendCatalog>['legends'][number];

export function PlayLegendPicker({
  selectedVariantNumber,
  onSelect,
  onClear,
}: PlayLegendPickerProps) {
  const [contentWidth, setContentWidth] = useState(0);
  const { tileWidth, gap, numColumns } = useResponsiveColumns('grid', {
    measuredWidth: contentWidth > 0 ? contentWidth : undefined,
    fillAvailable: true,
  });

  const { query, setQuery, legends, loading, loadingMore, hasNextPage, fetchNextPage } =
    useLegendCatalog();

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== contentWidth) setContentWidth(next);
  };

  const columnWrapperStyle = useMemo(
    () => (numColumns > 1 ? { gap, marginBottom: gap } : undefined),
    [gap, numColumns]
  );

  const listContentStyle = useMemo(
    () => ({
      gap: numColumns === 1 ? gap : undefined,
      flexGrow: legends.length === 0 ? 1 : undefined,
    }),
    [gap, legends.length, numColumns]
  );

  const listFooter = useMemo(
    () => (
      <>
        {hasNextPage ? (
          <View className="pt-2">
            <Button
              variant="outline"
              busy={loadingMore}
              disabled={loadingMore}
              onPress={fetchNextPage}
            >
              <ButtonText>{loadingMore ? 'Loading…' : 'Load more legends'}</ButtonText>
            </Button>
          </View>
        ) : null}
        <ListBottomSpacer height={8} />
      </>
    ),
    [fetchNextPage, hasNextPage, loadingMore]
  );

  const renderLegendItem = useCallback<ListRenderItem<LegendCatalogItem>>(
    ({ item }) => {
      const selected = item.variantNumber === selectedVariantNumber;
      const artLabel =
        item.variantType && item.variantType !== 'Standard' ? item.variantType : null;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`Select ${item.name}${artLabel ? `, ${artLabel}` : ''}`}
          style={{ width: tileWidth }}
          className="gap-1.5 active:opacity-90"
          onPress={() => {
            hapticPress();
            onSelect({
              name: item.name,
              variantNumber: item.variantNumber,
              imageUrl: item.imageUrl ?? null,
              ...(artLabel ? { variantLabel: artLabel } : {}),
            });
          }}
        >
          <View
            className={cn(
              'aspect-[5/7] w-full overflow-hidden border bg-background',
              CARD_ART_RADIUS_CLASS,
              selected ? 'border-foreground' : 'border-border'
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
          <Text
            className={cn(
              'text-[12px] font-semibold',
              selected ? 'text-foreground' : 'text-muted-foreground'
            )}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <Text
            className="font-mono text-[10px] text-muted-foreground"
            numberOfLines={1}
          >
            {artLabel ?? item.variantNumber}
          </Text>
        </Pressable>
      );
    },
    [onSelect, selectedVariantNumber, tileWidth]
  );

  return (
    <View className="min-h-0 flex-1 gap-3" onLayout={onLayout}>
      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search legends"
        autoFocus
      />

      {onClear && selectedVariantNumber ? (
        <Button
          variant="ghost"
          onPress={() => {
            hapticPress();
            onClear();
          }}
        >
          <ButtonText className="text-muted-foreground">Clear legend</ButtonText>
        </Button>
      ) : null}

      {loading && legends.length === 0 ? (
        <View className="flex-1 items-center justify-center py-16">
          <AppLoader size="md" />
        </View>
      ) : (
        <FlatList
          data={legends}
          key={numColumns}
          keyExtractor={(item) => item.variantNumber}
          numColumns={numColumns}
          columnWrapperStyle={columnWrapperStyle}
          contentContainerStyle={listContentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          className="min-h-0 flex-1"
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <ThemedIcon icon={SearchIcon} size={28} color="muted-foreground" />
              <Text className="text-sm text-muted-foreground">
                No legends match your search
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
