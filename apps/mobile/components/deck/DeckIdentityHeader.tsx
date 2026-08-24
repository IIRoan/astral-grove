import type { ReactNode } from 'react';
import { View } from 'react-native';
import { DeckCardSlot } from '@/components/deck/DeckCardSlot';
import { resolveSlotImage } from '@/components/deck/deckCardSlot.utils';
import { DeckRunePanel } from '@/components/deck/DeckRunePanel';
import { Text } from '@/components/ui/text';
import { isCardTournamentIllegal } from '@/lib/card-legality';
import type { DeckCard, DeckState } from '@/lib/deck-types';
import { ownedCountForCardName } from '@/lib/deck-validation';
import type { CardOpenSource } from '@/utils/cardNavigation';
import { cn } from '@/lib/utils';

interface DeckIdentityHeaderProps {
  deck: DeckState;
  readOnly?: boolean;
  legendTileWidth: number;
  /** Equal columns in narrow drawer; leave false in showcase so tileWidth caps apply. */
  stretchSlots?: boolean;
  imageByVariant: ReadonlyMap<string, string>;
  collectionByName: ReadonlyMap<string, number>;
  runeCardsByDomain: ReadonlyMap<string, DeckCard>;
  runeCardsLoading?: boolean;
  onChangeLegend: () => void;
  onRemoveLegend?: () => void;
  onAddChampion: () => void;
  onRemoveChampion: () => void;
  onAdjustRune: (domain: string, delta: number) => void;
  runePlacement?: 'below' | 'beside';
  openSource?: CardOpenSource;
}

function IdentitySlotBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('min-w-0 gap-2', className)}>
      <Text
        className="text-[13px] font-normal leading-4 text-foreground"
        numberOfLines={1}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export function DeckIdentityHeader({
  deck,
  readOnly = false,
  legendTileWidth,
  stretchSlots = false,
  imageByVariant,
  collectionByName,
  runeCardsByDomain,
  runeCardsLoading = false,
  onChangeLegend,
  onRemoveLegend,
  onAddChampion,
  onRemoveChampion,
  onAdjustRune,
  runePlacement = 'below',
  openSource,
}: DeckIdentityHeaderProps) {
  const legend = deck.legend;
  const tileWidth = legendTileWidth;
  const runesBeside = runePlacement === 'beside';
  const isPreRift = deck.format === 'pre-rift';
  const legendTitle = isPreRift ? 'Legend (optional)' : 'Legend';
  const legendPlaceholder = isPreRift ? 'Add Legend (optional)' : 'Choose Legend';
  const championTitle = isPreRift ? 'Champion (optional)' : 'Champion';
  const championPlaceholder = isPreRift ? 'Add Champion (optional)' : 'Add Champion';
  const columnClass = stretchSlots ? 'min-w-0 flex-1' : undefined;

  const legendSlot = legend ? (
    <DeckCardSlot
      variant="card"
      tileWidth={tileWidth}
      stretch={stretchSlots}
      card={legend}
      imageUri={resolveSlotImage(legend, imageByVariant)}
      owned={ownedCountForCardName(legend.name, collectionByName)}
      illegal={isCardTournamentIllegal(legend, deck)}
      single
      openSource={openSource}
      onPress={readOnly ? undefined : onChangeLegend}
      onRemove={readOnly ? undefined : (onRemoveLegend ?? onChangeLegend)}
    />
  ) : (
    <DeckCardSlot
      variant="identity"
      tileWidth={tileWidth}
      stretch={stretchSlots}
      label={legendPlaceholder}
      onAdd={readOnly ? undefined : onChangeLegend}
    />
  );

  const showChampion = Boolean(legend) || deck.format === 'pre-rift';
  const championSlot = showChampion ? (
    deck.champion ? (
      <DeckCardSlot
        variant="card"
        tileWidth={tileWidth}
        stretch={stretchSlots}
        card={deck.champion}
        imageUri={resolveSlotImage(deck.champion, imageByVariant)}
        owned={ownedCountForCardName(deck.champion.name, collectionByName)}
        illegal={isCardTournamentIllegal(deck.champion, deck)}
        single
        openSource={openSource}
        onAdd={readOnly ? undefined : onAddChampion}
        onRemove={readOnly ? undefined : onRemoveChampion}
      />
    ) : (
      <DeckCardSlot
        variant="identity"
        tileWidth={tileWidth}
        stretch={stretchSlots}
        label={championPlaceholder}
        onAdd={readOnly ? undefined : onAddChampion}
      />
    )
  ) : null;

  const showRunes = Boolean(legend) || deck.format === 'pre-rift';
  const runePanel = showRunes ? (
    <DeckRunePanel
      deck={deck}
      readOnly={readOnly}
      runeCardsByDomain={runeCardsByDomain}
      runeCardsLoading={runeCardsLoading}
      onAdjust={onAdjustRune}
      dense
      compact={runesBeside}
    />
  ) : null;

  if (runesBeside && runePanel) {
    // Two columns bottom-aligned: legend+champion left, rune summary right beside tiles.
    return (
      <View className="w-full min-w-0 flex-row items-end gap-4">
        <View className="min-w-0 flex-row gap-3">
          <IdentitySlotBlock title={legendTitle}>{legendSlot}</IdentitySlotBlock>
          {championSlot ? (
            <IdentitySlotBlock title={championTitle}>{championSlot}</IdentitySlotBlock>
          ) : null}
        </View>
        <View className="min-w-0 max-w-[15rem] flex-1 pb-1">{runePanel}</View>
      </View>
    );
  }

  return (
    <View className="w-full min-w-0 gap-4">
      <View className="w-full min-w-0 flex-row flex-wrap items-start gap-2">
        <IdentitySlotBlock title={legendTitle} className={columnClass}>
          {legendSlot}
        </IdentitySlotBlock>

        {championSlot ? (
          <IdentitySlotBlock title={championTitle} className={columnClass}>
            {championSlot}
          </IdentitySlotBlock>
        ) : null}
      </View>

      {runePanel ? (
        <View className="w-full min-w-0 border-t border-border pt-4">{runePanel}</View>
      ) : null}
    </View>
  );
}
