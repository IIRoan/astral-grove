import { ThemedIcon, ChevronLeftIcon } from '@/components/icons';
import { Pressable, View } from 'react-native';
import { deckBuilderHeadlineStats } from '@/components/deck/deckBuilderStatusStrip.utils';
import { Text } from '@/components/ui/text';
import { getSectionCount } from '@/lib/deck-card';
import {
  deckSectionsForFormat,
  type DeckSectionKey,
  type DeckState,
} from '@/lib/deck-types';
import { cn } from '@/lib/utils';

export function DeckAddScreenHeader({
  deck,
  section,
  onBack,
}: {
  deck: DeckState;
  section: DeckSectionKey;
  onBack: () => void;
}) {
  const meta = deckSectionsForFormat(deck.format).find(
    (entry) => entry.key === section
  );
  const count = getSectionCount(deck, section);
  const target = meta?.target ?? 0;
  const complete = meta?.single || meta?.isMin ? count >= target : count === target;

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to deck"
          className="size-10 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel"
          onPress={onBack}
        >
          <ThemedIcon icon={ChevronLeftIcon} size={22} color="foreground" />
        </Pressable>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-semibold text-foreground">
            Add to {meta?.title ?? section}
          </Text>
          <Text className="font-mono text-[11px] text-muted-foreground">
            {deckBuilderHeadlineStats(deck)}
          </Text>
        </View>
        {meta ? (
          <View
            className={cn(
              'shrink-0 rounded-[3px] border px-2.5 py-1.5',
              complete
                ? 'border-success/30 bg-success/5'
                : 'border-border bg-card-panel'
            )}
          >
            <Text
              className={cn(
                'font-mono text-sm font-normal tabular-nums',
                complete ? 'text-success' : 'text-foreground'
              )}
            >
              {count}/{target}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
