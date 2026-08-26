import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import {
  collapseEnergyBuckets,
  countScaleMax,
  type DeckStatBucket,
} from '@/lib/deck-stats';
import { domainFillClass } from '@/lib/domain-fill';
import { cn } from '@/lib/utils';

const PLOT_HEIGHT = 36;

interface DeckListEnergyCurveProps {
  buckets: readonly DeckStatBucket[];
}

export function DeckListEnergyCurve({ buckets }: DeckListEnergyCurveProps) {
  const collapsed = collapseEnergyBuckets(buckets);
  const maxCount = collapsed.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  const scaleMax = countScaleMax(maxCount);

  return (
    <View accessibilityLabel="Energy curve">
      <View className="flex-row items-end">
        {collapsed.map((bucket) => {
          const barHeight =
            bucket.count > 0 ? Math.max((bucket.count / scaleMax) * PLOT_HEIGHT, 3) : 0;
          const slices = bucket.stack;
          const domainSummary = slices
            .map((slice) => `${slice.domain} ${slice.count}`)
            .join(', ');
          const axis = bucket.label ?? String(bucket.value);
          const summary =
            bucket.count > 0
              ? domainSummary
                ? `Energy ${axis}, ${bucket.count} cards, ${domainSummary}`
                : `Energy ${axis}, ${bucket.count}`
              : `Energy ${axis}, none`;

          return (
            <View
              key={axis}
              className="min-w-0 flex-1 items-center"
              accessibilityLabel={summary}
            >
              <View className="h-4 w-full items-center justify-end">
                {bucket.count > 0 ? (
                  <Text
                    className="font-mono text-[10px] font-medium leading-3 tabular-nums text-foreground"
                    numberOfLines={1}
                  >
                    {bucket.count}
                  </Text>
                ) : null}
              </View>
              <View
                className="w-full justify-end border-b border-border px-px"
                style={{ height: PLOT_HEIGHT }}
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
              <Text className="mt-1 font-mono text-[10px] leading-3 tabular-nums text-muted-foreground">
                {axis}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
