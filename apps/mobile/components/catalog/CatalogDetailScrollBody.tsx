import { ActivityIndicator, Pressable, View } from 'react-native';
import { BookmarkIcon } from '@/components/icons';
import { VariantPriceSummary } from '@/components/catalog/VariantPriceSummary';
import { CardRulesText } from '@/components/riftbound/CardRulesText';
import { WishlistPriceHistoryPanel } from '@/components/wishlist/WishlistPriceHistoryPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { OPERATE_SECONDARY_FILL_CLASS } from '@/constants/operateType';
import type { WishlistPriceItem } from '@/hooks/useWishlistPrices';
import type { PriceHistoryPanelItem } from '@/hooks/useVariantPriceHistory';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface CatalogDetailScrollBodyProps {
  printingRows: React.ReactNode;
  addedLog?: React.ReactNode;
  statsRow: React.ReactNode;
  metaAttributes: React.ReactNode;
  descriptionBlock: React.ReactNode;
  isWatchingActive: boolean;
  watchBusy: boolean;
  onWatchPress: () => void;
  singleMarketPrice: { label: string; price: string } | null;
  singlePriceTrend: string;
  hidePriceHistory: boolean;
  variantFamilyCount: number;
  wishlistItem: WishlistPriceItem | null;
  activeVariantNumber: string;
  activeCardmarketId: number | null;
  priceHistory: {
    panelItem: PriceHistoryPanelItem | null;
    isLoading: boolean;
  };
}

function SectionDivider() {
  return <View className="h-hairline bg-border/60" />;
}

export function CatalogDetailScrollBody({
  printingRows,
  addedLog,
  statsRow,
  metaAttributes,
  descriptionBlock,
  isWatchingActive,
  watchBusy,
  onWatchPress,
  singleMarketPrice,
  singlePriceTrend,
  hidePriceHistory,
  variantFamilyCount,
  wishlistItem,
  activeVariantNumber,
  activeCardmarketId,
  priceHistory,
}: CatalogDetailScrollBodyProps) {
  return (
    <View>
      {printingRows ? (
        <>
          <SectionDivider />
          {printingRows}
        </>
      ) : null}

      <SectionDivider />
      {addedLog}
      <View className="px-1 py-1">{statsRow}</View>

      <SectionDivider />
      <View className="px-3 py-3">{metaAttributes}</View>

      <SectionDivider />
      <View className="gap-3 px-3 py-3">
        {descriptionBlock}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isWatchingActive ? 'Remove from wishlist' : 'Add to wishlist'
          }
          disabled={watchBusy}
          onPress={() => {
            void hapticPress();
            onWatchPress();
          }}
          className={cn(
            'h-8 w-full flex-row items-center justify-center gap-1.5 rounded-[3px] px-3.5 web:cursor-pointer active:opacity-80',
            OPERATE_SECONDARY_FILL_CLASS,
            watchBusy && 'opacity-60'
          )}
        >
          {watchBusy ? (
            <ActivityIndicator size="small" className="accent-foreground" />
          ) : (
            <>
              <BookmarkIcon
                className="size-3.5 text-foreground"
                weight={isWatchingActive ? 'fill' : 'bold'}
              />
              <Text className="text-[13px] font-bold tracking-tight text-foreground">
                {isWatchingActive ? 'Wishlisted' : 'Wishlist'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {singleMarketPrice && hidePriceHistory ? (
        <>
          <SectionDivider />
          <View className="px-3 py-3">
            <VariantPriceSummary
              label={singleMarketPrice.label}
              price={singleMarketPrice.price}
              trend={singlePriceTrend}
              className="mt-0"
              hideLabel={variantFamilyCount > 1}
            />
          </View>
        </>
      ) : null}
      {!hidePriceHistory ? (
        <>
          <SectionDivider />
          <View className="px-3 py-3" style={{ minHeight: 140 }}>
            {wishlistItem && wishlistItem.variantNumber === activeVariantNumber ? (
              <WishlistPriceHistoryPanel
                item={{
                  ...wishlistItem,
                  cardmarketId: wishlistItem.cardmarketId ?? activeCardmarketId,
                }}
                className="border-0 bg-transparent p-0"
              />
            ) : priceHistory.panelItem ? (
              <WishlistPriceHistoryPanel
                item={{
                  ...priceHistory.panelItem,
                  cardmarketId:
                    priceHistory.panelItem.cardmarketId ?? activeCardmarketId,
                }}
                className="border-0 bg-transparent p-0"
              />
            ) : priceHistory.isLoading ? (
              <View className="min-h-[140px] justify-center py-3">
                <Text className="text-xs leading-5 text-muted-foreground">
                  Loading daily trend history…
                </Text>
              </View>
            ) : (
              <WishlistPriceHistoryPanel
                item={{
                  points: [],
                  trend: '—',
                  baselinePrice: null,
                  listingLow: null,
                  cardmarketId: activeCardmarketId,
                }}
                className="border-0 bg-transparent p-0"
              />
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

export function CatalogDetailDescriptionBlock({
  isPlaceholder,
  description,
}: {
  isPlaceholder: boolean;
  description: string | null | undefined;
}) {
  if (isPlaceholder && !description) {
    return (
      <View className="gap-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-[92%] rounded" />
        <Skeleton className="h-3 w-[80%] rounded" />
      </View>
    );
  }
  if (!description) return null;
  return <CardRulesText text={description} />;
}
