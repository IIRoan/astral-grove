import { View } from 'react-native';
import { DeckCardSlot } from '@/components/deck/DeckCardSlot';
import { resolveSlotImage } from '@/components/deck/deckCardSlot.utils';
import { DeckSectionHeader } from '@/components/deck/DeckSectionHeader';
import { buildDeckGridRows, deckGridRowKey } from '@/lib/deck-builder';
import { deckSectionProgress } from '@/lib/deck-display';
import type { DeckSectionKey, DeckState } from '@/lib/deck-types';
import { isCardTournamentIllegal } from '@/lib/card-legality';
import { ownedCountForCardName } from '@/lib/deck-validation';
import type { CardOpenSource } from '@/utils/cardNavigation';

interface DeckSectionGridProps {
  deck: DeckState;
  section: Exclude<DeckSectionKey, 'legend' | 'champion' | 'runes'>;
  readOnly?: boolean;
  title: string;
  tileWidth: number;
  gap: number;
  gridColumns: number;
  imageByVariant: ReadonlyMap<string, string>;
  collectionByName: ReadonlyMap<string, number>;
  openSource?: CardOpenSource;
  onAdd: () => void;
  onMinus: (name: string) => void;
  onPlus: (name: string) => void;
  onRemove: (name: string) => void;
}

function DeckGridRow({
  row,
  tileWidth,
  gap,
  imageByVariant,
  collectionByName,
  readOnly,
  deck,
  openSource,
  onAdd,
  onMinus,
  onPlus,
  onRemove,
}: {
  row: ReturnType<typeof buildDeckGridRows>[number];
  tileWidth: number;
  gap: number;
  imageByVariant: ReadonlyMap<string, string>;
  collectionByName: ReadonlyMap<string, number>;
  readOnly?: boolean;
  deck: DeckState;
  openSource?: CardOpenSource;
  onAdd: () => void;
  onMinus: (name: string) => void;
  onPlus: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  return (
    <View className="flex-row" style={{ gap, marginBottom: gap }}>
      {row.map((cell) => {
        if (cell.kind === 'add') {
          return (
            <DeckCardSlot key="add" variant="add" tileWidth={tileWidth} onAdd={onAdd} />
          );
        }

        if (cell.kind !== 'card') {
          return null;
        }

        const { entry } = cell;
        const owned = ownedCountForCardName(entry.card.name, collectionByName);
        const illegal = isCardTournamentIllegal(entry.card, deck);
        return (
          <DeckCardSlot
            key={entry.card.name}
            variant="card"
            tileWidth={tileWidth}
            card={entry.card}
            entry={entry}
            imageUri={resolveSlotImage(entry.card, imageByVariant)}
            owned={owned}
            illegal={illegal}
            openSource={openSource}
            onMinus={() => onMinus(entry.card.name)}
            onPlus={() => onPlus(entry.card.name)}
            onRemove={readOnly ? undefined : () => onRemove(entry.card.name)}
          />
        );
      })}
    </View>
  );
}

export function DeckSectionGrid({
  deck,
  section,
  readOnly = false,
  title,
  tileWidth,
  gap,
  gridColumns,
  imageByVariant,
  collectionByName,
  onAdd,
  onMinus,
  onPlus,
  onRemove,
  openSource,
}: DeckSectionGridProps) {
  const entries = [...deck[section].values()].sort((a, b) => {
    if (a.card.energy !== b.card.energy) return a.card.energy - b.card.energy;
    return a.card.name.localeCompare(b.card.name);
  });

  const rows = buildDeckGridRows(entries, {
    columns: gridColumns,
    includeAdd: !readOnly,
  });

  const progress = deckSectionProgress(deck, section);

  return (
    <View className="gap-3">
      <DeckSectionHeader
        title={title}
        current={progress.current}
        target={progress.target}
        hint={progress.hint}
        readOnly={readOnly}
        onAdd={readOnly ? undefined : onAdd}
      />

      <View>
        {rows.map((row) => (
          <DeckGridRow
            key={deckGridRowKey(row)}
            row={row}
            tileWidth={tileWidth}
            gap={gap}
            imageByVariant={imageByVariant}
            collectionByName={collectionByName}
            readOnly={readOnly}
            deck={deck}
            openSource={openSource}
            onAdd={onAdd}
            onMinus={onMinus}
            onPlus={onPlus}
            onRemove={onRemove}
          />
        ))}
      </View>
    </View>
  );
}
