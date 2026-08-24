import { ThemedIcon, LockIcon, PlusIcon } from '@/components/icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { BattlefieldCardArt } from '@/components/deck/BattlefieldCardArt';
import { CardArtInfoPreviewButton } from '@/components/deck/CardArtInfoPreviewButton';
import { resolveSlotImage } from '@/components/deck/deckCardSlot.utils';
import { DeckQtyControl } from '@/components/deck/DeckQtyControl';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { buildBattlefieldSlots } from '@/lib/deck-builder';
import { BATTLEFIELD_MAX, battlefieldsAtCapacity } from '@/lib/deck-limits';
import { isCardTournamentIllegal } from '@/lib/card-legality';
import type { DeckEntry, DeckState } from '@/lib/deck-types';
import { openCard, type CardOpenSource } from '@/utils/cardNavigation';
import { hapticPress } from '@/utils/haptics';
import {
  OPERATE_CTA_FILL_CLASS,
  OPERATE_CTA_ICON_CLASS,
} from '@/constants/operateType';
import { cn } from '@/lib/utils';

interface DeckBattlefieldPanelProps {
  deck: DeckState;
  readOnly?: boolean;
  imageByVariant: ReadonlyMap<string, string>;
  openSource?: CardOpenSource;
  onAdd: () => void;
  onRemove: (name: string) => void;
  onAdjust?: (name: string, delta: number) => void;
}

function BattlefieldSlot({
  index,
  slot,
  deck,
  readOnly,
  canAdd,
  imageByVariant,
  openSource,
  onAdd,
  onRemove,
  onAdjust,
}: {
  index: number;
  slot: DeckEntry | null;
  deck: DeckState;
  readOnly?: boolean;
  canAdd: boolean;
  imageByVariant: ReadonlyMap<string, string>;
  openSource?: CardOpenSource;
  onAdd: () => void;
  onRemove: (name: string) => void;
  onAdjust?: (name: string, delta: number) => void;
}) {
  const router = useRouter();
  const slotNumber = index + 1;

  if (!slot) {
    const interactive = !readOnly && canAdd;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Battlefield slot ${slotNumber}`}
        accessibilityState={{ disabled: !interactive }}
        className={cn('min-w-0 flex-1', interactive && 'active:opacity-90')}
        disabled={!interactive}
        onPress={() => {
          if (!interactive) return;
          hapticPress();
          onAdd();
        }}
      >
        <View
          className={cn(
            'aspect-[7/5] w-full items-center justify-center border border-dashed bg-card-panel',
            CARD_ART_RADIUS_CLASS,
            interactive ? 'border-border' : 'border-border/60 opacity-60'
          )}
        >
          {interactive ? (
            <ThemedIcon icon={PlusIcon} size={20} color="foreground" />
          ) : (
            <ThemedIcon icon={LockIcon} size={18} color="muted-foreground" />
          )}
        </View>
      </Pressable>
    );
  }

  const { card } = slot;
  const imageUri = resolveSlotImage(card, imageByVariant);
  const illegal = isCardTournamentIllegal(card, deck);
  // Expanded slots are one copy each; Pre-Rift remove decrements qty instead of wiping the name.
  const removeOne =
    deck.format === 'pre-rift' && onAdjust != null
      ? () => onAdjust(card.name, -1)
      : () => onRemove(card.name);

  return (
    <View className="min-w-0 flex-1 gap-1.5">
      <View
        className={cn(
          'relative aspect-[7/5] w-full overflow-hidden border bg-background',
          CARD_ART_RADIUS_CLASS,
          illegal ? 'border-destructive' : 'border-border'
        )}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${card.name}`}
          className="absolute inset-0 active:opacity-90"
          onPress={() => {
            hapticPress();
            openCard(router, card.variantNumber, 'modal', openSource);
          }}
        >
          <BattlefieldCardArt uri={imageUri} variantNumber={card.variantNumber} />
        </Pressable>

        <CardArtInfoPreviewButton
          imageUri={imageUri}
          variantNumber={card.variantNumber}
          name={card.name}
          orientation="landscape"
        />
      </View>

      <Text
        className="px-0.5 text-[11px] font-normal text-foreground"
        numberOfLines={1}
      >
        {card.name}
      </Text>

      {readOnly ? null : (
        <DeckQtyControl count={1} name={card.name} single onRemove={removeOne} />
      )}
    </View>
  );
}

const BATTLEFIELD_SLOT_IDS = ['bf-slot-1', 'bf-slot-2', 'bf-slot-3'] as const;

export function DeckBattlefieldPanel({
  deck,
  readOnly = false,
  imageByVariant,
  openSource,
  onAdd,
  onRemove,
  onAdjust,
}: DeckBattlefieldPanelProps) {
  const slots = buildBattlefieldSlots(deck.battlefields);
  const count = slots.filter(Boolean).length;
  const atCapacity = battlefieldsAtCapacity(deck);
  const canAdd = !atCapacity;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
          <Text className="text-sm font-normal text-foreground">Battlefields</Text>
          <Text
            className={cn(
              'font-mono text-[11px] font-normal tabular-nums',
              count === BATTLEFIELD_MAX ? 'text-success' : 'text-muted-foreground'
            )}
          >
            {count}/{BATTLEFIELD_MAX}
          </Text>
        </View>
        {!readOnly && canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add battlefield"
            className={cn(
              'h-8 shrink-0 flex-row items-center gap-1 rounded-[3px] px-2.5 active:opacity-80',
              OPERATE_CTA_FILL_CLASS
            )}
            onPress={() => {
              hapticPress();
              onAdd();
            }}
          >
            <PlusIcon
              className={cn('size-3.5', OPERATE_CTA_ICON_CLASS)}
              weight="bold"
            />
            <Text className="text-[12px] font-medium tracking-tight text-cta-foreground">
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row gap-2">
        {BATTLEFIELD_SLOT_IDS.map((slotId, slotIndex) => {
          const slot = slots[slotIndex] ?? null;
          return (
            <BattlefieldSlot
              key={slot ? `${slotId}:${slot.card.name}` : slotId}
              index={slotIndex}
              slot={slot}
              deck={deck}
              readOnly={readOnly}
              canAdd={canAdd}
              imageByVariant={imageByVariant}
              openSource={openSource}
              onAdd={onAdd}
              onRemove={onRemove}
              onAdjust={onAdjust}
            />
          );
        })}
      </View>
    </View>
  );
}
