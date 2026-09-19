import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { ChevronLeftIcon, LightningIcon, ThemedIcon } from '@/components/icons';
import { ListSpacer } from '@/components/ui/list-spacer';
import { DeckStatsHistogram } from '@/components/deck/DeckStatsHistogram';
import { DeckStatsMixList } from '@/components/deck/DeckStatsMixList';
import { Text } from '@/components/ui/text';
import {
  formatDeckStatAverage,
  type DeckStatFact,
  type DeckStats,
} from '@/lib/deck-stats';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

const TWO_COL_MIN_WIDTH = 560;

interface DeckStatsPanelProps {
  stats: DeckStats;
  paddingBottom?: number;
  onClose?: () => void;
  closeLabel?: string;
}

function StatSection({
  label,
  meta,
  icon,
  children,
  className,
}: {
  label: string;
  meta?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-4', className)}>
      <View className="flex-row items-baseline justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {icon}
          <Text className="font-mono text-[12px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
            {label}
          </Text>
        </View>
        {meta ? (
          <Text className="font-mono text-[12px] font-medium tabular-nums text-foreground">
            {meta}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function StatFacts({ facts }: { facts: readonly DeckStatFact[] }) {
  return (
    <View className="flex-row flex-wrap items-baseline gap-x-8 gap-y-2">
      {facts.map((fact) => (
        <View key={fact.key} className="flex-row items-baseline gap-2">
          <Text className="font-mono text-[12px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
            {fact.label}
          </Text>
          <Text className="font-mono text-[13px] font-medium tabular-nums text-foreground">
            {fact.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StatPair({ twoCol, children }: { twoCol: boolean; children: ReactNode }) {
  return (
    <View
      className={cn(
        twoCol ? 'flex-row gap-10' : 'gap-10',
        'border-t border-border pt-8'
      )}
    >
      {children}
    </View>
  );
}

export function DeckStatsPanel({
  stats,
  paddingBottom = 0,
  onClose,
  closeLabel = 'Cards',
}: DeckStatsPanelProps) {
  const [contentWidth, setContentWidth] = useState(0);
  const twoCol = contentWidth >= TWO_COL_MIN_WIDTH;
  const empty = stats.cardCount === 0;
  const domainMeta =
    stats.domains.length > 0 ? `${stats.domains.length} active` : undefined;
  const typeMeta = stats.types.length > 0 ? `${stats.types.length} types` : undefined;
  const uniqueCount = stats.facts.find((fact) => fact.key === 'unique')?.count ?? 0;
  const copyMeta = uniqueCount > 0 ? `${uniqueCount} names` : undefined;
  const rarityMeta =
    stats.rarities.length > 0 ? `${stats.rarities.length} present` : undefined;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== contentWidth) setContentWidth(next);
  };

  return (
    <View className="min-h-0 flex-1">
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            closeLabel === 'Deck' ? 'Show deck showcase' : 'Show card catalog'
          }
          onPress={() => {
            hapticPress();
            onClose();
          }}
          className="flex-row items-center gap-2 self-start px-3 pb-1 pt-3 active:opacity-80"
        >
          <View className="size-10 items-center justify-center rounded-[3px] border border-border bg-card">
            <ThemedIcon icon={ChevronLeftIcon} size={18} color="foreground" />
          </View>
          <Text className="text-sm font-medium text-foreground">{closeLabel}</Text>
        </Pressable>
      ) : null}
      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ gap: 40 }}
        contentContainerClassName="px-4 py-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onLayout={onLayout}
      >
        <View className={twoCol ? 'flex-row gap-10' : 'gap-10'}>
          <View className={twoCol ? 'min-w-0 flex-1 gap-4' : 'gap-4'}>
            <StatSection
              label="Energy curve"
              meta={`avg ${formatDeckStatAverage(stats.avgEnergy)}`}
              icon={
                <ThemedIcon icon={LightningIcon} size={12} color="muted-foreground" />
              }
            >
              {empty ? (
                <Text className="text-sm leading-5 text-muted-foreground">
                  Add main-deck cards to plot energy.
                </Text>
              ) : null}
              <DeckStatsHistogram buckets={stats.energy} accessibilityUnit="Energy" />
            </StatSection>
          </View>
          <View className={twoCol ? 'min-w-0 flex-1 gap-4' : 'gap-4'}>
            <StatSection
              label="Power curve"
              meta={`avg ${formatDeckStatAverage(stats.avgPower)}`}
            >
              {empty ? (
                <Text className="text-sm leading-5 text-muted-foreground">
                  Add main-deck cards to plot power.
                </Text>
              ) : null}
              <DeckStatsHistogram buckets={stats.power} accessibilityUnit="Power" />
            </StatSection>
          </View>
        </View>

        <StatPair twoCol={twoCol}>
          <StatSection
            label="Domains"
            meta={domainMeta}
            className={twoCol ? 'min-w-0 flex-1' : undefined}
          >
            <DeckStatsMixList
              items={stats.domains}
              emptyLabel="Domains appear once the main deck has cards."
            />
          </StatSection>
          <StatSection
            label="Card types"
            meta={typeMeta}
            className={twoCol ? 'min-w-0 flex-1' : undefined}
          >
            <DeckStatsMixList
              items={stats.types}
              emptyLabel="Types appear once the main deck has cards."
            />
          </StatSection>
        </StatPair>

        <StatPair twoCol={twoCol}>
          <StatSection
            label="Curve shape"
            className={twoCol ? 'min-w-0 flex-1' : undefined}
          >
            <DeckStatsMixList
              items={stats.bands}
              emptyLabel="Low, mid, and high energy appear once the main deck has cards."
            />
          </StatSection>
          <StatSection
            label="Copies"
            meta={copyMeta}
            className={twoCol ? 'min-w-0 flex-1' : undefined}
          >
            <DeckStatsMixList
              items={stats.copies}
              emptyLabel="Copy density appears once the main deck has cards."
            />
          </StatSection>
        </StatPair>

        <StatPair twoCol={twoCol}>
          <StatSection
            label="Rarity"
            meta={rarityMeta}
            className={twoCol ? 'min-w-0 flex-1' : undefined}
          >
            <DeckStatsMixList
              items={stats.rarities}
              emptyLabel="Rarity mix appears once the main deck has cards."
            />
          </StatSection>
          <StatSection label="List" className={twoCol ? 'min-w-0 flex-1' : undefined}>
            {empty ? (
              <Text className="text-sm leading-5 text-muted-foreground">
                Unique names, dual-domain copies, and signatures appear with the main
                deck.
              </Text>
            ) : (
              <StatFacts facts={stats.facts} />
            )}
          </StatSection>
        </StatPair>

        <ListSpacer height={paddingBottom} />
      </ScrollView>
    </View>
  );
}
