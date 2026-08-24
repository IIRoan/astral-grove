import { ThemedIcon, StarIcon } from '@/components/icons';
import { Image } from 'expo-image';
import { useCallback, useMemo } from 'react';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Pressable, View } from 'react-native';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { DeckCardCountBadge } from '@/components/deck/DeckCardCountBadge';
import { DeckLegalityBadge } from '@/components/deck/DeckLegalityBadge';
import { ContentKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { domainIconFor } from '@/constants/gameAssets';
import { deckBrowseSummaryLine } from '@/lib/deck-browse';
import { deckHasBannedCards } from '@/lib/card-legality';
import { useDeckLiveLegality } from '@/hooks/useBanDatesByVariant';
import { deckVariantNumbersKey, resolveDeckCardImageUrl } from '@/lib/deck-card';
import { deckMainCompositionLines } from '@/lib/deck-display';
import type { DeckEntry, DeckState } from '@/lib/deck-types';
import { useDeckCardImages } from '@/hooks/useDeckCardImages';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const LEGEND_RAIL_WIDTH = 172;
const MAIN_DECK_THUMB_WIDTH = 42;
const MAIN_DECK_PREVIEW_LIMIT = 8;

interface DeckBrowseCardProps {
  deck: DeckState;
  onPress: () => void;
  onImport?: () => void;
  importBusy?: boolean;
}

function MainDeckThumb({ entry, imageUri }: { entry: DeckEntry; imageUri: string }) {
  return (
    <View
      accessibilityLabel={`${entry.count} ${entry.card.name}`}
      style={{ width: MAIN_DECK_THUMB_WIDTH }}
    >
      <View
        className={cn(
          'relative aspect-[5/7] w-full overflow-hidden border border-border bg-background',
          CARD_ART_RADIUS_CLASS
        )}
      >
        <DeckCardArt uri={imageUri} variantNumber={entry.card.variantNumber} />
        <DeckCardCountBadge count={entry.count} />
      </View>
    </View>
  );
}

export function DeckBrowseCard({
  deck,
  onPress,
  onImport,
  importBusy = false,
}: DeckBrowseCardProps) {
  const { deck: liveDeck } = useDeckLiveLegality(deck);
  const displayDeck = liveDeck ?? deck;
  const variantKey = deckVariantNumbersKey(displayDeck);
  const { data: imageByVariant = new Map<string, string>() } =
    useDeckCardImages(variantKey);
  const legendUri = displayDeck.legend
    ? resolveDeckCardImageUrl(displayDeck.legend, imageByVariant)
    : '';
  const summary = deckBrowseSummaryLine(displayDeck);
  const legendColors = displayDeck.legend?.colors ?? [];
  const { hiddenCount, totalCards } = deckMainCompositionLines(
    displayDeck,
    MAIN_DECK_PREVIEW_LIMIT
  );
  const descriptionPreview = deck.description?.trim() ?? '';

  const mainDeckEntries = useMemo(() => {
    return [...deck.mainDeck.values()]
      .sort((a, b) => {
        if (a.card.energy !== b.card.energy) return a.card.energy - b.card.energy;
        return a.card.name.localeCompare(b.card.name);
      })
      .slice(0, MAIN_DECK_PREVIEW_LIMIT);
  }, [deck.mainDeck]);

  const renderMainDeckThumb = useCallback<ListRenderItem<DeckEntry>>(
    ({ item: entry }) => (
      <MainDeckThumb
        entry={entry}
        imageUri={resolveDeckCardImageUrl(entry.card, imageByVariant)}
      />
    ),
    [imageByVariant]
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        hapticPress();
        onPress();
      }}
      className="overflow-hidden rounded-[10px] border border-border bg-card active:border-foreground active:bg-card-panel"
    >
      <View className="min-h-[148px] flex-row items-stretch">
        <View
          className="shrink-0 border-r border-border bg-background p-1.5"
          style={{ width: LEGEND_RAIL_WIDTH }}
        >
          <View
            className={cn(
              'h-full flex-1 overflow-hidden border border-border bg-background',
              CARD_ART_RADIUS_CLASS
            )}
          >
            {deck.legend ? (
              <DeckCardArt uri={legendUri} variantNumber={deck.legend.variantNumber} />
            ) : (
              <View className="flex-1 items-center justify-center bg-card-panel">
                <ThemedIcon icon={StarIcon} size={24} color="muted-foreground" />
              </View>
            )}
          </View>
        </View>

        <View className="min-w-0 flex-1 justify-between gap-1.5 p-2.5">
          <View className="gap-1">
            <View className="flex-row items-start gap-2">
              <Text
                className="min-w-0 flex-1 text-[14px] font-normal leading-[18px] text-foreground"
                numberOfLines={2}
              >
                {deck.name}
              </Text>
              {totalCards > 0 ? (
                <View className="rounded-[3px] border border-border bg-card-panel px-1.5 py-0.5">
                  <Text className="font-mono text-[10px] font-normal tabular-nums text-foreground">
                    {totalCards}
                  </Text>
                </View>
              ) : null}
            </View>
            {summary ? (
              <Text
                className="text-[10px] leading-3.5 text-muted-foreground"
                numberOfLines={1}
              >
                {summary}
              </Text>
            ) : null}
          </View>

          {mainDeckEntries.length > 0 ? (
            <View className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-[10px] font-normal text-muted-foreground">
                  Main deck
                </Text>
                {hiddenCount > 0 ? (
                  <Text className="font-mono text-[9px] text-muted-foreground">
                    +{hiddenCount} more
                  </Text>
                ) : null}
              </View>
              <FlashList
                horizontal
                data={mainDeckEntries}
                keyExtractor={(entry) => entry.card.name}
                renderItem={renderMainDeckThumb}
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-1.5 pr-1"
              />
            </View>
          ) : descriptionPreview ? (
            <Text
              className="text-[11px] leading-4 text-muted-foreground"
              numberOfLines={2}
            >
              {descriptionPreview}
            </Text>
          ) : null}

          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1">
              {legendColors.map((color) => {
                const icon = domainIconFor(color);
                if (!icon) return null;
                return (
                  <Image
                    key={color}
                    source={icon}
                    style={{ width: 18, height: 18, borderRadius: 9 }}
                    contentFit="cover"
                    accessibilityLabel={color}
                  />
                );
              })}
              {displayDeck.isLegal !== undefined || deckHasBannedCards(displayDeck) ? (
                <DeckLegalityBadge
                  isLegal={
                    !deckHasBannedCards(displayDeck) && displayDeck.isLegal !== false
                  }
                  compact
                />
              ) : null}
              {deck.hasVideo ? <ContentKeywordBadge type="video" /> : null}
              {deck.hasMatchups ? <ContentKeywordBadge type="matchups" /> : null}
              {deck.hasGuide ? <ContentKeywordBadge type="guide" /> : null}
            </View>

            {onImport ? (
              <Pressable
                accessibilityLabel={`Import ${deck.name}`}
                disabled={importBusy}
                className="shrink-0 rounded-[3px] border border-border bg-card-panel px-2.5 py-1 active:bg-card-panel"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onImport();
                }}
              >
                <Text className="text-[11px] font-normal text-foreground">
                  {importBusy ? 'Importing…' : 'Import'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
