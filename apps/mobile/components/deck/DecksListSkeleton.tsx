import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export function DeckListSkeleton() {
  return (
    <SkeletonGroup>
      <View className="gap-3">
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            className="overflow-hidden rounded-[10px] border border-border bg-card p-3.5"
          >
            <View className="flex-row gap-3">
              <Skeleton className="h-[101px] w-[72px] rounded-[10px]" />
              <View className="min-w-0 flex-1 gap-2">
                <Skeleton className="h-5 w-44 rounded" />
                <View className="flex-row gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-[3px]" />
                  <Skeleton className="h-5 w-12 rounded-[3px]" />
                </View>
                <View className="flex-row gap-1.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="size-4 rounded-full" />
                </View>
                <Skeleton className="h-3 w-36 rounded" />
                <Skeleton className="mt-1 h-3 w-28 rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}
