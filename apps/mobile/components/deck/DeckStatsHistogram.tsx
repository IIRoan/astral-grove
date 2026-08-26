import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { countScaleMax, countScaleTicks, type DeckStatBucket } from '@/lib/deck-stats';
import { domainFillClass } from '@/lib/domain-fill';
import { cn } from '@/lib/utils';

const FULL_HEIGHT = 144;
const COMPACT_HEIGHT = 52;
const SCALE_GUTTER = 22;

interface DeckStatsHistogramProps {
  buckets: readonly DeckStatBucket[];
  compact?: boolean;
  accessibilityUnit: string;
}

export function DeckStatsHistogram({
  buckets,
  compact = false,
  accessibilityUnit,
}: DeckStatsHistogramProps) {
  const plotHeight = compact ? COMPACT_HEIGHT : FULL_HEIGHT;
  const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  const scaleMax = countScaleMax(maxCount);
  const ticks = countScaleTicks(scaleMax);

  return (
    <View
      className={cn(
        compact ? 'bg-card-panel/50 px-0.5 pt-1' : 'bg-card-panel px-1.5 pt-2'
      )}
    >
      <View className="flex-row">
        {compact ? null : <View style={{ width: SCALE_GUTTER }} className="shrink-0" />}
        <View className="min-w-0 flex-1 flex-row items-end">
          {buckets.map((bucket) => (
            <View key={bucket.value} className="min-w-0 flex-1 items-center">
              <View
                className={cn(
                  'w-full items-center justify-end',
                  compact ? 'h-5' : 'h-6'
                )}
              >
                {bucket.count > 0 ? (
                  <Text
                    className={cn(
                      'font-mono font-medium tabular-nums text-foreground',
                      compact ? 'text-[11px] leading-4' : 'text-xs leading-5'
                    )}
                    numberOfLines={1}
                  >
                    {bucket.count}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="flex-row items-end">
        {compact ? null : (
          <View
            className="shrink-0 justify-between pr-1"
            style={{ width: SCALE_GUTTER, height: plotHeight }}
          >
            {ticks.map((tick) => (
              <Text
                key={tick}
                className="text-right font-mono text-[10px] leading-3 tabular-nums text-muted-foreground"
              >
                {tick}
              </Text>
            ))}
          </View>
        )}
        <View className="min-w-0 flex-1 flex-row items-end">
          {buckets.map((bucket) => {
            const barHeight =
              bucket.count > 0
                ? Math.max((bucket.count / scaleMax) * plotHeight, compact ? 3 : 4)
                : 0;
            const slices = bucket.stack.length > 0 ? bucket.stack : [];
            const domainSummary = slices
              .map((slice) => `${slice.domain} ${slice.count}`)
              .join(', ');
            const summary =
              bucket.count > 0
                ? domainSummary
                  ? `${accessibilityUnit} ${bucket.value}, ${bucket.count} cards, ${domainSummary}`
                  : `${accessibilityUnit} ${bucket.value}, ${bucket.count}`
                : `${accessibilityUnit} ${bucket.value}, none`;

            return (
              <View
                key={bucket.value}
                className="min-w-0 flex-1 items-center"
                accessibilityLabel={summary}
              >
                <View
                  className={cn(
                    'w-full justify-end border-b border-border',
                    compact ? 'px-px' : 'px-1'
                  )}
                  style={{ height: plotHeight }}
                >
                  {barHeight > 0 ? (
                    <View
                      className="w-full flex-col-reverse overflow-hidden"
                      style={{ height: barHeight }}
                    >
                      {slices.length > 0 ? (
                        slices.map((slice) => (
                          <View
                            key={slice.domain}
                            className={cn('w-full', domainFillClass(slice.domain))}
                            style={{
                              height: (slice.count / bucket.count) * barHeight,
                            }}
                          />
                        ))
                      ) : (
                        <View
                          className="w-full bg-muted-foreground"
                          style={{ height: barHeight }}
                        />
                      )}
                    </View>
                  ) : (
                    <View className="w-full bg-border" style={{ height: 1 }} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View className="flex-row">
        {compact ? null : <View style={{ width: SCALE_GUTTER }} className="shrink-0" />}
        <View className="min-w-0 flex-1 flex-row">
          {buckets.map((bucket) => (
            <View key={bucket.value} className="min-w-0 flex-1 items-center">
              <Text
                className={cn(
                  'mt-1.5 font-mono tabular-nums text-muted-foreground',
                  compact ? 'text-[10px] leading-3' : 'text-[11px] leading-4'
                )}
              >
                {bucket.label ?? bucket.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
