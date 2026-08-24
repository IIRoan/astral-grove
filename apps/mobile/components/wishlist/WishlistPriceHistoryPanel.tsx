import { useState } from 'react';
import { useValueChangeFlag } from '@/hooks/useValueChangeFlag';
import { Pressable, View } from 'react-native';
import { ShoppingCartIcon, ThemedIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';
import type { PriceHistoryPanelItem } from '@/hooks/useVariantPriceHistory';
import { buildCardmarketProductUrl } from '@/lib/cardmarket';
import { openExternalUrl } from '@/lib/open-external';
import {
  chartScaleMax,
  chartScaleTicks,
  formatAxisPrice,
  formatPricePointDate,
} from '@/lib/wishlist-price-points';
import { cn } from '@/lib/utils';

const CHART_HEIGHT = 88;

function formatPrice(value: number | null): string {
  return value == null ? '—' : `€${value.toFixed(2)}`;
}

function CardmarketIconButton({ cardmarketId }: { cardmarketId: number }) {
  return (
    <Pressable
      onPress={() => {
        void openExternalUrl(buildCardmarketProductUrl(cardmarketId));
      }}
      accessibilityRole="link"
      accessibilityLabel="Open on Cardmarket"
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-[3px] border border-border bg-transparent web:cursor-pointer active:opacity-70"
    >
      <ThemedIcon icon={ShoppingCartIcon} size={16} color="foreground" />
    </Pressable>
  );
}

export function WishlistPriceHistoryPanel({
  item,
  className,
}: {
  item: PriceHistoryPanelItem;
  className?: string;
}) {
  const points = item.points;
  const cardmarketId = item.cardmarketId ?? null;
  const latestDate = points.at(-1)?.priceDate ?? null;
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const pointsChanged = useValueChangeFlag(points);
  if (pointsChanged) {
    if (hoveredDate !== null) {
      setHoveredDate(null);
    }
    if (pickedDate != null && !points.some((point) => point.priceDate === pickedDate)) {
      setPickedDate(null);
    }
  }
  const selectedDate =
    pickedDate != null && points.some((point) => point.priceDate === pickedDate)
      ? pickedDate
      : latestDate;

  const activeDate = hoveredDate ?? selectedDate;
  const active =
    points.find((point) => point.priceDate === activeDate) ?? points.at(-1) ?? null;

  if (points.length === 0) {
    return (
      <View
        className={cn('rounded-[10px] border border-border bg-card p-3', className)}
      >
        <View className="flex-row items-center gap-3">
          <Text className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            No trend history yet.
          </Text>
          {cardmarketId != null ? (
            <CardmarketIconButton cardmarketId={cardmarketId} />
          ) : null}
        </View>
      </View>
    );
  }

  const maxValue = Math.max(...points.map((point) => point.value));
  const scaleMax = chartScaleMax(maxValue);
  const [tickTop, tickMid, tickBottom] = chartScaleTicks(scaleMax);
  const first = points[0]!;
  const last = points.at(-1)!;

  return (
    <View className={cn('rounded-[10px] border border-border bg-card p-3', className)}>
      <View className="mb-3 flex-row items-center gap-3">
        <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
          <Text className="font-mono text-lg font-normal tabular-nums text-foreground">
            {formatPrice(active?.value ?? null)}
          </Text>
          {active ? (
            <Text className="text-xs text-muted-foreground">
              {formatPricePointDate(active.priceDate)}
            </Text>
          ) : null}
        </View>
        {cardmarketId != null ? (
          <CardmarketIconButton cardmarketId={cardmarketId} />
        ) : null}
      </View>

      <View className="flex-row gap-2">
        <View className="w-10 justify-between" style={{ height: CHART_HEIGHT }}>
          <Text className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatAxisPrice(tickTop)}
          </Text>
          <Text className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatAxisPrice(tickMid)}
          </Text>
          <Text className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatAxisPrice(tickBottom)}
          </Text>
        </View>

        <View className="min-w-0 flex-1">
          <View
            className="relative flex-row items-end border-b border-border/50"
            style={{ height: CHART_HEIGHT }}
          >
            <View
              pointerEvents="none"
              className="absolute inset-x-0 border-t border-border/35"
              style={{ top: CHART_HEIGHT / 2 }}
            />
            {points.map((point) => {
              const barHeight = Math.max((point.value / scaleMax) * CHART_HEIGHT, 2);
              const isActive = point.priceDate === active?.priceDate;
              return (
                <Pressable
                  key={point.priceDate}
                  onPress={() => {
                    setPickedDate(point.priceDate);
                  }}
                  onHoverIn={() => {
                    setHoveredDate(point.priceDate);
                  }}
                  onHoverOut={() => {
                    setHoveredDate((current) =>
                      current === point.priceDate ? null : current
                    );
                  }}
                  className="h-full min-w-0 flex-1 items-center justify-end px-px web:cursor-pointer"
                  accessibilityRole="button"
                  accessibilityState={{ selected: point.priceDate === selectedDate }}
                  accessibilityLabel={`${formatPricePointDate(point.priceDate)}, ${formatPrice(point.value)}`}
                >
                  <View
                    className={cn(
                      'w-full rounded-t-sm',
                      isActive ? 'bg-foreground' : 'bg-muted-foreground/35'
                    )}
                    style={{ height: barHeight }}
                  />
                </Pressable>
              );
            })}
          </View>

          <View className="mt-1.5 flex-row items-center justify-between">
            <Text className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatPricePointDate(first.priceDate)}
            </Text>
            <Text className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatPricePointDate(last.priceDate)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
