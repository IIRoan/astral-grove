import { ScrollView, View } from 'react-native';
import { ListSpacer } from '@/components/ui/list-spacer';
import { DeckBattlefieldPanel } from '@/components/deck/DeckBattlefieldPanel';
import {
  DeckBuilderMiddlePanelToggle,
  type DeckBuilderMiddlePanel,
} from '@/components/deck/DeckBuilderMiddlePanelToggle';
import { DeckIdentityHeader } from '@/components/deck/DeckIdentityHeader';
import { DeckViewInfoPanel } from '@/components/deck/DeckViewInfoPanel';
import { DeckLegalityBadge } from '@/components/deck/DeckLegalityBadge';
import { deckHasBannedCards } from '@/lib/card-legality';
import type { DeckCard, DeckState } from '@/lib/deck-types';

export const DECK_INFO_DRAWER_WIDTH = 280;
/** Matches `px-3` on the drawer body — keep in sync with content padding. */
export const DECK_INFO_DRAWER_PAD = 12;
/** Shared column gutter for identity + battlefield slots (search-page 8px rhythm). */
export const DECK_INFO_SLOT_GAP = 8;

interface DeckBuilderInfoDrawerProps {
  deck: DeckState;
  readOnly?: boolean;
  imageByVariant: ReadonlyMap<string, string>;
  collectionByName: ReadonlyMap<string, number>;
  runeCardsByDomain: ReadonlyMap<string, DeckCard>;
  runeCardsLoading?: boolean;
  onChangeLegend: () => void;
  onRemoveLegend?: () => void;
  onAddChampion: () => void;
  onRemoveChampion: () => void;
  onAdjustRune: (domain: string, delta: number) => void;
  onAddBattlefield: () => void;
  onRemoveBattlefield: (name: string) => void;
  onAdjustBattlefield?: (name: string, delta: number) => void;
  middlePanel?: DeckBuilderMiddlePanel;
  onMiddlePanelChange?: (panel: DeckBuilderMiddlePanel) => void;
  paddingBottom?: number;
  scrollEnabled?: boolean;
}

export function DeckBuilderInfoDrawer({
  deck,
  readOnly = false,
  imageByVariant,
  collectionByName,
  runeCardsByDomain,
  runeCardsLoading = false,
  onChangeLegend,
  onRemoveLegend,
  onAddChampion,
  onRemoveChampion,
  onAdjustRune,
  onAddBattlefield,
  onRemoveBattlefield,
  onAdjustBattlefield,
  middlePanel,
  onMiddlePanelChange,
  paddingBottom = 0,
  scrollEnabled = true,
}: DeckBuilderInfoDrawerProps) {
  const identityInnerWidth = DECK_INFO_DRAWER_WIDTH - DECK_INFO_DRAWER_PAD * 2;
  const identityPairColumns = deck.legend != null || deck.format === 'pre-rift';
  const legendTileWidth = identityPairColumns
    ? Math.floor((identityInnerWidth - DECK_INFO_SLOT_GAP) / 2)
    : identityInnerWidth;

  const body = (
    <>
      <DeckIdentityHeader
        deck={deck}
        readOnly={readOnly}
        legendTileWidth={legendTileWidth}
        stretchSlots
        imageByVariant={imageByVariant}
        collectionByName={collectionByName}
        runeCardsByDomain={runeCardsByDomain}
        runeCardsLoading={runeCardsLoading}
        onChangeLegend={onChangeLegend}
        onRemoveLegend={onRemoveLegend}
        onAddChampion={onAddChampion}
        onRemoveChampion={onRemoveChampion}
        onAdjustRune={onAdjustRune}
      />

      <View className="border-t border-border pt-4">
        <DeckBattlefieldPanel
          deck={deck}
          readOnly={readOnly}
          imageByVariant={imageByVariant}
          onAdd={onAddBattlefield}
          onRemove={onRemoveBattlefield}
          onAdjust={onAdjustBattlefield}
        />
      </View>

      {!readOnly && middlePanel != null && onMiddlePanelChange != null ? (
        <DeckBuilderMiddlePanelToggle
          value={middlePanel}
          onChange={onMiddlePanelChange}
        />
      ) : null}

      {readOnly ? (
        <DeckViewInfoPanel deck={deck} />
      ) : deckHasBannedCards(deck) ? (
        <View className="self-start">
          <DeckLegalityBadge isLegal={false} />
        </View>
      ) : null}
    </>
  );

  if (!scrollEnabled) {
    return <View className="gap-4 px-3 py-3">{body}</View>;
  }

  return (
    <ScrollView
      className="min-h-0 flex-1"
      contentContainerStyle={{ gap: 16 }}
      contentContainerClassName="px-3 py-3"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {body}
      <ListSpacer height={paddingBottom} />
    </ScrollView>
  );
}
