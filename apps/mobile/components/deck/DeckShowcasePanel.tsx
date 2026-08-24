import { useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { DeckBattlefieldPanel } from '@/components/deck/DeckBattlefieldPanel';
import { DeckDescriptionView } from '@/components/deck/DeckDescription';
import { DeckIdentityHeader } from '@/components/deck/DeckIdentityHeader';
import { DeckSectionGrid } from '@/components/deck/DeckSectionGrid';
import { DeckViewInfoPanel } from '@/components/deck/DeckViewInfoPanel';
import { DeckLegalityBadge } from '@/components/deck/DeckLegalityBadge';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { deckHasBannedCards } from '@/lib/card-legality';
import { getSectionCount } from '@/lib/deck-card';
import { computeShowcaseIdentityTileWidth } from '@/lib/deck-showcase-layout';
import type { DeckCard, DeckState } from '@/lib/deck-types';
import { cn } from '@/lib/utils';

/** Side-by-side runes need ~560px+; phones stack (two tiles + rune column). */
const RUNES_BESIDE_MIN_WIDTH = 560;

interface DeckShowcasePanelProps {
  deck: DeckState;
  imageByVariant: ReadonlyMap<string, string>;
  collectionByName: ReadonlyMap<string, number>;
  runeCardsByDomain: ReadonlyMap<string, DeckCard>;
  paddingBottom?: number;
  className?: string;
}

export function DeckShowcasePanel({
  deck,
  imageByVariant,
  collectionByName,
  runeCardsByDomain,
  paddingBottom = 0,
  className,
}: DeckShowcasePanelProps) {
  const isMobile = useMobileLayout();
  const [contentWidth, setContentWidth] = useState(0);
  const hasWidth = contentWidth > 0;
  // Same column math as the Cards catalog: max-capped on mobile/tablet, fill-available on desktop.
  const grid = useResponsiveColumns('grid', {
    measuredWidth: hasWidth ? contentWidth : null,
    fillAvailable: true,
  });
  const runesBeside = !isMobile && hasWidth && contentWidth >= RUNES_BESIDE_MIN_WIDTH;
  const identityTileWidth = computeShowcaseIdentityTileWidth(contentWidth, runesBeside);
  const sideCount = getSectionCount(deck, 'sideboard');

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== contentWidth) setContentWidth(next);
  };

  return (
    <ScrollView
      className={cn('min-h-0 flex-1', className)}
      contentContainerStyle={{ gap: 24 }}
      contentContainerClassName="w-full max-w-full px-1 py-1"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onLayout={onLayout}
    >
      <DeckDescriptionView description={deck.description} />

      <DeckIdentityHeader
        deck={deck}
        readOnly
        legendTileWidth={identityTileWidth}
        imageByVariant={imageByVariant}
        collectionByName={collectionByName}
        runeCardsByDomain={runeCardsByDomain}
        runePlacement={runesBeside ? 'beside' : 'below'}
        openSource="deck-view"
        onChangeLegend={() => undefined}
        onAddChampion={() => undefined}
        onRemoveChampion={() => undefined}
        onAdjustRune={() => undefined}
      />

      <DeckBattlefieldPanel
        deck={deck}
        readOnly
        imageByVariant={imageByVariant}
        openSource="deck-view"
        onAdd={() => undefined}
        onRemove={() => undefined}
      />

      {hasWidth ? (
        <DeckSectionGrid
          deck={deck}
          section="mainDeck"
          readOnly
          title="Main Deck"
          tileWidth={grid.tileWidth}
          gap={grid.gap}
          gridColumns={grid.numColumns}
          imageByVariant={imageByVariant}
          collectionByName={collectionByName}
          openSource="deck-view"
          onAdd={() => undefined}
          onMinus={() => undefined}
          onPlus={() => undefined}
          onRemove={() => undefined}
        />
      ) : null}

      {hasWidth && (sideCount > 0 || deck.addToSideboard) ? (
        <DeckSectionGrid
          deck={deck}
          section="sideboard"
          readOnly
          title="Sideboard"
          tileWidth={grid.tileWidth}
          gap={grid.gap}
          gridColumns={grid.numColumns}
          imageByVariant={imageByVariant}
          collectionByName={collectionByName}
          openSource="deck-view"
          onAdd={() => undefined}
          onMinus={() => undefined}
          onPlus={() => undefined}
          onRemove={() => undefined}
        />
      ) : null}

      {deck.readOnly ? (
        <DeckViewInfoPanel deck={deck} />
      ) : deckHasBannedCards(deck) ? (
        <View className="self-start">
          <DeckLegalityBadge isLegal={false} />
        </View>
      ) : null}
      <ListBottomSpacer height={paddingBottom} />
    </ScrollView>
  );
}
