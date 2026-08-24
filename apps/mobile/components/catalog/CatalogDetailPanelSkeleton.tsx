import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import {
  FACTORY_RADIUS_CONTROL_CLASS,
  FACTORY_RADIUS_PANEL_CLASS,
} from '@/constants/factoryShape';
import { cn } from '@/lib/utils';

export function CatalogDetailPanelSkeleton() {
  return (
    <View
      className={cn(
        'overflow-hidden border border-border bg-card',
        FACTORY_RADIUS_PANEL_CLASS
      )}
    >
      <SkeletonGroup>
        <View className="flex-row gap-3 p-3">
          <Skeleton
            className={cn('aspect-[5/7] w-[128px] shrink-0', CARD_ART_RADIUS_CLASS)}
          />

          <View className="min-w-0 flex-1 justify-center gap-2">
            <Skeleton className="h-6 w-[88%] rounded" />
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </View>
        </View>

        <View className="h-hairline bg-border/60" />
        <View className="flex-row items-center justify-between gap-3 px-3 py-3">
          <View className="gap-1.5">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </View>
          <Skeleton className={cn('h-8 w-[4.5rem]', FACTORY_RADIUS_CONTROL_CLASS)} />
        </View>

        <View className="h-hairline bg-border/60" />
        <View className="flex-row px-1 py-2">
          <View className="flex-1 items-center gap-1 py-1">
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </View>
          <View className="flex-1 items-center gap-1 py-1">
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-5 w-8 rounded" />
          </View>
          <View className="flex-1 items-center gap-1 py-1">
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-5 w-6 rounded" />
          </View>
        </View>

        <View className="h-hairline bg-border/60" />
        <View className="flex-row flex-wrap gap-x-4 gap-y-3 px-3 py-3">
          <View className="min-w-[42%] flex-1 gap-1">
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </View>
          <View className="min-w-[42%] flex-1 gap-1">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </View>
          <View className="min-w-[42%] flex-1 gap-1">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </View>
          <View className="min-w-[42%] flex-1 gap-1">
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </View>
        </View>

        <View className="h-hairline bg-border/60" />
        <View className="gap-3 px-3 py-3">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-[85%] rounded" />
          <Skeleton className={cn('h-10 w-full', FACTORY_RADIUS_CONTROL_CLASS)} />
        </View>

        <View className="h-hairline bg-border/60" />
        <View className="gap-3 px-3 py-3">
          <View className="flex-row items-center justify-between">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className={cn('h-9 w-9', FACTORY_RADIUS_CONTROL_CLASS)} />
          </View>
          <Skeleton className={cn('h-[120px] w-full', FACTORY_RADIUS_PANEL_CLASS)} />
        </View>
      </SkeletonGroup>
    </View>
  );
}
