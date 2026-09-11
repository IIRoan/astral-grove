import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { LEGEND_RAIL_NARROW } from '@/components/deck/DeckLegendRail';
import { legendFullCardHeight } from '@/lib/legend-list-art';

const ART_HEIGHT = legendFullCardHeight(LEGEND_RAIL_NARROW);

export function DeckListSkeleton() {
  return (
    <SkeletonGroup>
      <View className="gap-3">
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            className="overflow-hidden rounded-[10px] border border-border bg-card"
          >
            <View className="flex-row">
              <Skeleton
                className="rounded-none"
                style={{ width: LEGEND_RAIL_NARROW, height: ART_HEIGHT }}
              />
              <View className="min-w-0 flex-1 gap-2.5 p-3">
                <Skeleton className="h-5 w-44 rounded" />
                <View className="flex-row gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-[3px]" />
                  <Skeleton className="h-5 w-12 rounded-[3px]" />
                </View>
                <View className="flex-row gap-1.5">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="size-6 rounded-full" />
                </View>
                <Skeleton className="h-3 w-40 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}
