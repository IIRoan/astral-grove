import { Image } from 'expo-image';
import { Children, isValidElement, type ReactNode } from 'react';
import { Platform, View, type ImageSourcePropType } from 'react-native';
import type { typeIconFor } from '@/constants/gameAssets';
import { Text } from '@/components/ui/text';
import { useFillGridLayout } from '@/hooks/useFillGridLayout';
import { useScreenLayout } from '@/components/shell/ScreenLayout';
import type { MergedSetStat } from '@/utils/collectionStats';
import { cn } from '@/lib/utils';
import { keyHash } from '@/lib/react-list-keys';

const SET_CARD_MIN_WIDTH = 280;
const SET_CARD_MAX_COLUMNS = 4;
const SET_GRID_GAP = 16;
const STAT_MIN_WIDTH = 140;
const STAT_MAX_COLUMNS = 4;
const STAT_GRID_GAP = 12;

function ArchiveProgressBar({
  progress,
  className,
  thin = false,
}: {
  progress: number;
  className?: string;
  thin?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, progress * 100));
  return (
    <View
      className={cn(
        'overflow-hidden rounded-[3px] bg-card-panel',
        thin ? 'h-1' : 'h-1.5',
        className
      )}
    >
      <View
        className="h-full rounded-[3px] bg-foreground"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}

function SetLogoImage({ source }: { source: ImageSourcePropType }) {
  return (
    <Image
      source={source}
      style={{ width: 88, height: 22 }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={0}
      accessibilityIgnoresInvertColors
    />
  );
}

export function DashboardStat({
  label,
  value,
  sub,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  progress?: number;
}) {
  return (
    <View className="w-full rounded-[10px] border border-border bg-card p-4">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      <Text className="mt-2 font-mono text-2xl font-normal tabular-nums text-foreground">
        {value}
      </Text>
      <Text className="mt-1 text-xs text-archive-subtle">{sub}</Text>
      {progress !== undefined ? (
        <ArchiveProgressBar progress={progress} className="mt-3" />
      ) : null}
    </View>
  );
}

export function BreakdownSection({
  title,
  stats,
  iconFor,
}: {
  title: string;
  stats: { name: string; owned: number; total: number }[];
  iconFor?: (name: string) => ReturnType<typeof typeIconFor>;
}) {
  return (
    <View className="rounded-[10px] border border-border bg-card p-4">
      <Text className="mb-3 text-sm font-normal text-foreground">{title}</Text>
      <View className="gap-3">
        {stats.map((stat) => {
          const pct = stat.total > 0 ? (stat.owned / stat.total) * 100 : 0;
          const icon = iconFor?.(stat.name);
          return (
            <View key={stat.name}>
              <View className="flex-row items-center justify-between gap-4">
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  {icon ? (
                    <Image
                      source={icon}
                      className="size-5 shrink-0"
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                  ) : null}
                  <Text className="text-[13px] font-medium text-foreground">
                    {stat.name}
                  </Text>
                </View>
                <Text className="font-mono text-[13px] font-normal tabular-nums text-foreground">
                  {stat.owned} / {stat.total}
                </Text>
              </View>
              <View className="mt-1.5">
                <ArchiveProgressBar progress={pct / 100} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SetCard({ set }: { set: MergedSetStat }) {
  const completion = set.total > 0 ? (set.owned / set.total) * 100 : 0;
  const nonFoilCompletion =
    set.nonFoilTotal > 0 ? (set.nonFoilOwned / set.nonFoilTotal) * 100 : 0;
  const foilCompletion = set.foilTotal > 0 ? (set.foilOwned / set.foilTotal) * 100 : 0;

  return (
    <View className="overflow-hidden rounded-[10px] border border-border bg-card">
      {set.art ? (
        <View
          className="relative w-full overflow-hidden bg-card-panel"
          style={{ aspectRatio: 16 / 5 }}
        >
          <Image
            source={set.art}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            accessibilityLabel={`${set.name} key art`}
          />
          {Platform.OS === 'web' ? (
            <View className="absolute inset-0 bg-gradient-to-t from-card from-0% via-card/40 via-40% to-transparent to-100%" />
          ) : (
            <>
              <View className="absolute inset-0 bg-background/50" />
              <View className="absolute bottom-0 left-0 right-0 h-1/2 bg-card/90" />
            </>
          )}
          <View className="absolute bottom-2 left-3 flex-row items-center gap-2">
            {set.logo ? <SetLogoImage source={set.logo} /> : null}
            <Text className="font-mono text-xs font-normal text-foreground">
              {set.code}
            </Text>
          </View>
        </View>
      ) : set.logo ? (
        <View className="flex-row items-center justify-between bg-card-panel px-4 py-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <SetLogoImage source={set.logo} />
            <Text className="font-mono text-xs font-normal text-foreground">
              {set.code}
            </Text>
          </View>
          <Text className="shrink-0 font-mono text-xs text-archive-subtle">
            {set.total} cards
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between bg-card-panel px-4 py-3">
          <Text className="font-mono text-xs font-normal text-foreground">
            {set.code}
          </Text>
          <Text className="font-mono text-xs text-archive-subtle">
            {set.total} cards
          </Text>
        </View>
      )}

      <View className="p-4">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="min-w-0 flex-1 text-sm font-normal text-foreground">
            {set.name}
          </Text>
          {set.released ? (
            <Text className="shrink-0 font-mono text-xs text-archive-subtle">
              {set.released}
            </Text>
          ) : null}
        </View>
        {set.art ? (
          <Text className="mt-1 font-mono text-xs text-archive-subtle">
            {set.total} cards
          </Text>
        ) : null}
        <View className="mt-3 gap-3">
          <ProgressRow
            label="Non-foil"
            value={`${set.nonFoilOwned}/${set.nonFoilTotal}`}
            progress={nonFoilCompletion / 100}
          />
          <ProgressRow
            label="Foils"
            value={`${set.foilOwned}/${set.foilTotal}`}
            progress={foilCompletion / 100}
          />
        </View>
        <View className="mt-3 flex-row items-center justify-between border-t border-archive-soft-line pt-3">
          <Text className="text-[13px] text-muted-foreground">Completion</Text>
          <Text className="font-mono text-[13px] font-normal tabular-nums text-foreground">
            {completion.toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProgressRow({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-4">
        <Text className="text-[13px] font-medium text-muted-foreground">{label}</Text>
        <Text className="font-mono text-[13px] font-normal tabular-nums text-foreground">
          {value}
        </Text>
      </View>
      <View className="mt-2">
        <ArchiveProgressBar progress={progress} thin />
      </View>
    </View>
  );
}

export function SetCardGrid({ sets }: { sets: MergedSetStat[] }) {
  const { itemWidth } = useFillGridLayout({
    minItemWidth: SET_CARD_MIN_WIDTH,
    maxColumns: SET_CARD_MAX_COLUMNS,
    gap: SET_GRID_GAP,
  });

  return (
    <View className="flex-row flex-wrap" style={{ gap: SET_GRID_GAP }}>
      {sets.map((set) => (
        <View key={set.code} style={{ width: itemWidth }}>
          <SetCard set={set} />
        </View>
      ))}
    </View>
  );
}

function dashboardStatChildKey(child: ReactNode): string {
  if (isValidElement(child)) {
    const props = child.props as { label?: unknown };
    if (typeof props.label === 'string') return props.label;
    if (child.key != null) return String(child.key);
  }
  return keyHash(String(child));
}

export function DashboardStatGrid({ children }: { children: ReactNode }) {
  const { contentWidth } = useScreenLayout();
  const { columns, itemWidth } = useFillGridLayout({
    minItemWidth: STAT_MIN_WIDTH,
    maxColumns: STAT_MAX_COLUMNS,
    gap: STAT_GRID_GAP,
  });

  return (
    <View className="mb-6 flex-row flex-wrap" style={{ gap: STAT_GRID_GAP }}>
      {Children.map(children, (child) => (
        <View
          key={dashboardStatChildKey(child)}
          style={{
            width: columns === 1 ? contentWidth : itemWidth,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
