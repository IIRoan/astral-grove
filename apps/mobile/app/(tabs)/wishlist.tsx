import {
  BookmarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ThemedIcon,
} from '@/components/icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { TrendTag } from '@/components/catalog/TrendTag';
import {
  ScreenLayout,
  ScreenLayoutBody,
  useScreenLayout,
} from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WishlistPriceHistoryPanel } from '@/components/wishlist/WishlistPriceHistoryPanel';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useWishlistPrices, type WishlistPriceItem } from '@/hooks/useWishlistPrices';
import { cn } from '@/lib/utils';
import { openCard } from '@/utils/cardNavigation';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import {
  CARDMARKET_PRICE_DETAIL_NOTE,
  matchesSearchHaystack,
} from '@riftbound/contracts';
import { useQueryClient } from '@tanstack/react-query';

/** Compact list thumb — portrait card crop with explicit size for native Image. */
const ROW_THUMB = { width: 40, height: 56 } as const;
/** Slightly larger art when a row is expanded on mobile. */
const EXPANDED_THUMB = { width: 72, height: 100 } as const;

type SortMode = 'move' | 'price' | 'name';

const EMPTY_WISHLIST_ITEMS: WishlistPriceItem[] = [];

function formatPrice(value: number | null): string {
  return value == null ? '—' : `€${value.toFixed(2)}`;
}

function trendDelta(item: WishlistPriceItem): number {
  return item.changePercent ?? 0;
}

function matchesQuery(item: WishlistPriceItem, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return matchesSearchHaystack(
    [item.name, item.variantNumber, item.priceFilterLabel ?? ''].join(' '),
    q
  );
}

function sortItems(items: WishlistPriceItem[], mode: SortMode): WishlistPriceItem[] {
  const next = [...items];
  if (mode === 'name') {
    return next.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (mode === 'price') {
    return next.sort((a, b) => (b.currentPrice ?? -1) - (a.currentPrice ?? -1));
  }
  return next.sort((a, b) => Math.abs(trendDelta(b)) - Math.abs(trendDelta(a)));
}

function MiniSparkline({ points }: { points: WishlistPriceItem['points'] }) {
  if (points.length < 2) {
    return <View className="h-7 justify-center" />;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.01);

  return (
    <View className="h-7 flex-row items-end gap-px" accessibilityElementsHidden>
      {points.map((point, index) => {
        const pct = (point.value - min) / span;
        const height = 3 + pct * 22;
        const isLatest = index === points.length - 1;
        return (
          <View
            key={point.priceDate}
            className={cn(
              'min-w-0 flex-1 rounded-t-[1px]',
              isLatest ? 'bg-foreground' : 'bg-muted-foreground/25'
            )}
            style={{ height }}
          />
        );
      })}
    </View>
  );
}

function WishlistCardThumb({
  imageUrl,
  variantNumber,
  size,
}: {
  imageUrl: string | null | undefined;
  variantNumber: string;
  size: { width: number; height: number };
}) {
  const uri = imageUrl ? resolveImageUrl(imageUrl) : null;
  if (!uri) {
    return (
      <View
        className={cn(
          'items-center justify-center bg-card-panel',
          CARD_ART_RADIUS_CLASS
        )}
        style={size}
      >
        <ThemedIcon icon={BookmarkIcon} size={16} color="muted-foreground" />
      </View>
    );
  }

  return (
    <View
      className={cn(
        'overflow-hidden border border-border/60 bg-card-panel',
        CARD_ART_RADIUS_CLASS
      )}
      style={size}
    >
      <CardArtImage
        uri={uri}
        recyclingKey={variantNumber}
        style={size}
        contentFit="cover"
        contentPosition="top"
        instant
      />
    </View>
  );
}

const WishlistRow = memo(function WishlistRow({
  item,
  expanded,
  compact,
  onToggle,
  onOpen,
}: {
  item: WishlistPriceItem;
  expanded: boolean;
  compact: boolean;
  onToggle: (variantNumber: string) => void;
  onOpen: (variantNumber: string) => void;
}) {
  const handleToggle = useCallback(() => {
    onToggle(item.variantNumber);
  }, [onToggle, item.variantNumber]);
  const handleOpen = useCallback(() => {
    onOpen(item.variantNumber);
  }, [onOpen, item.variantNumber]);

  return (
    <View className="border-b border-border">
      <Pressable
        onPress={handleToggle}
        onLongPress={handleOpen}
        className="min-h-14 flex-row items-center gap-3 py-3 active:opacity-90"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${item.name}, ${formatPrice(item.currentPrice)}, ${item.trend}`}
        accessibilityHint="Opens price details. Long press opens the card."
      >
        <WishlistCardThumb
          imageUrl={item.imageUrl}
          variantNumber={item.variantNumber}
          size={ROW_THUMB}
        />

        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            className="mt-0.5 font-mono text-[11px] text-muted-foreground"
            numberOfLines={1}
          >
            {item.variantNumber}
            {item.belowTarget ? ' · at target' : ''}
          </Text>
        </View>

        {!compact ? (
          <View className="w-[88px] shrink-0">
            <MiniSparkline points={item.points} />
          </View>
        ) : null}

        <View className="min-w-[72px] items-end">
          <Text className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
            {formatPrice(item.currentPrice)}
          </Text>
          <TrendTag trend={item.trend} className="mt-0.5" />
        </View>

        <ThemedIcon
          icon={expanded ? ChevronUpIcon : ChevronDownIcon}
          size={16}
          color="muted-foreground"
        />
      </Pressable>

      {expanded ? (
        <View className="gap-3 border-t border-border/60 bg-card-panel/40 pb-3.5 pt-3">
          {compact ? (
            <Pressable
              onPress={handleOpen}
              className="flex-row items-center gap-3 active:opacity-90"
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
            >
              <WishlistCardThumb
                imageUrl={item.imageUrl}
                variantNumber={item.variantNumber}
                size={EXPANDED_THUMB}
              />
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  className="text-[15px] font-semibold text-foreground"
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text className="font-mono text-[11px] text-muted-foreground">
                  {item.variantNumber}
                </Text>
                <Text className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
                  {formatPrice(item.currentPrice)}
                </Text>
                <TrendTag trend={item.trend} className="self-start" />
              </View>
            </Pressable>
          ) : null}
          <WishlistPriceHistoryPanel item={item} />
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onPress={handleOpen}
          >
            <ButtonText>Open card</ButtonText>
          </Button>
        </View>
      ) : null}
    </View>
  );
});

function WishlistLoadingSkeleton({ compact }: { compact: boolean }) {
  return (
    <SkeletonGroup>
      <View className="gap-0">
        {Array.from({ length: 8 }).map((_, index) => (
          <View
            key={index}
            className="flex-row items-center gap-3 border-b border-border py-3"
          >
            <Skeleton className="h-14 w-10 shrink-0 rounded-[3px]" />
            <View className="min-w-0 flex-1 gap-2">
              <Skeleton className="h-4 w-2/3 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </View>
            {!compact ? <Skeleton className="h-7 w-20 rounded" /> : null}
            <Skeleton className="h-4 w-14 rounded" />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

function WishlistScreenBody() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const compact = useMobileLayout();
  const { contentWidth, paddingBottomInline } = useScreenLayout();
  const [sort, setSort] = useState<SortMode>('move');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wishlist = useWishlistPrices();
  const items = wishlist.data ?? EMPTY_WISHLIST_ITEMS;

  const filtered = useMemo(
    () =>
      sortItems(
        items.filter((item) => matchesQuery(item, query)),
        sort
      ),
    [items, query, sort]
  );

  const atTargetCount = useMemo(
    () => items.filter((item) => item.belowTarget).length,
    [items]
  );

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const openItem = useCallback(
    (variantNumber: string) => {
      openCard(router, variantNumber, 'modal', 'wishlist', queryClient);
    },
    [router, queryClient]
  );

  const toggleRow = useCallback((variantNumber: string) => {
    setExpandedId((current) => (current === variantNumber ? null : variantNumber));
  }, []);

  const renderItem = useCallback<ListRenderItem<WishlistPriceItem>>(
    ({ item }) => (
      <WishlistRow
        item={item}
        compact={compact}
        expanded={expandedId === item.variantNumber}
        onToggle={toggleRow}
        onOpen={openItem}
      />
    ),
    [compact, expandedId, toggleRow, openItem]
  );

  const listHeader = (
    <View className="gap-4 pb-2">
      <View>
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          Wishlist
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {items.length === 0
            ? 'Track cards you want and watch Cardmarket trend prices.'
            : `${String(items.length)} ${items.length === 1 ? 'card' : 'cards'}${
                atTargetCount > 0 ? ` · ${String(atTargetCount)} at target` : ''
              }`}
        </Text>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or variant"
        accessibilityLabel="Search wishlist"
        className="min-h-12 rounded-[10px] border-border bg-card"
      />

      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Text className="text-xs text-muted-foreground">Last 30 days</Text>
        <View className="flex-row items-center gap-1" accessibilityRole="tablist">
          {(
            [
              { value: 'move', label: 'Move' },
              { value: 'price', label: 'Price' },
              { value: 'name', label: 'Name' },
            ] as const
          ).map((option) => {
            const active = sort === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setSort(option.value);
                }}
                className={cn(
                  'min-h-9 rounded-[3px] px-2.5 py-1.5',
                  active ? 'bg-secondary' : 'active:opacity-70'
                )}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  className={cn(
                    'text-[12px]',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {items.length > 0 ? (
        <View className="flex-row items-baseline justify-between border-b border-border pb-2">
          <Text className="text-xs text-muted-foreground">
            {query.trim()
              ? `${String(filtered.length)} match${filtered.length === 1 ? '' : 'es'}`
              : 'Tap a row for history'}
          </Text>
          <Text className="font-mono text-[10px] text-archive-subtle">EUR trend</Text>
        </View>
      ) : null}
    </View>
  );

  if (wishlist.isLoading) {
    return (
      <View style={{ width: contentWidth }} className="gap-4">
        {listHeader}
        <WishlistLoadingSkeleton compact={compact} />
      </View>
    );
  }

  return (
    <FlashList
      data={filtered}
      keyExtractor={(item) => item.variantNumber}
      ListHeaderComponent={listHeader}
      renderItem={renderItem}
      ListEmptyComponent={
        <View className="py-10">
          {items.length === 0 ? (
            <View className="gap-3">
              <Text className="text-base font-semibold text-foreground">
                No wishlist cards yet
              </Text>
              <Text className="max-w-md text-sm leading-6 text-muted-foreground">
                Save a printing from the catalog. Your list stays compact so you can
                scan prices quickly, then expand a row when you want history.
              </Text>
              <Button
                className="mt-2 self-start"
                onPress={() => {
                  router.push('/(tabs)/search');
                }}
              >
                <ButtonText>Browse catalog</ButtonText>
              </Button>
            </View>
          ) : (
            <Text className="text-center text-sm text-muted-foreground">
              No cards match “{query.trim()}”.
            </Text>
          )}
        </View>
      }
      ListFooterComponent={
        <>
          {items.length > 0 ? (
            <Text className="pb-2 pt-5 text-xs leading-5 text-muted-foreground">
              {CARDMARKET_PRICE_DETAIL_NOTE}
            </Text>
          ) : null}
          <ListBottomSpacer height={paddingBottomInline} />
        </>
      }
      contentContainerStyle={{
        width: contentWidth,
        maxWidth: '100%',
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={dismissKeyboard}
      showsVerticalScrollIndicator={false}
      extraData={{ expandedId, compact }}
    />
  );
}

export default function WishlistScreen() {
  return (
    <ScreenLayout mode="flex" contentClassName="flex-1">
      <ScreenLayoutBody>
        <WishlistScreenBody />
      </ScreenLayoutBody>
    </ScreenLayout>
  );
}
