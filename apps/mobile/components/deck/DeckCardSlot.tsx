import { LockIcon, PlusIcon, StarIcon, ThemedIcon, XIcon } from '@/components/icons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { CardArtInfoPreviewButton } from '@/components/deck/CardArtInfoPreviewButton';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { DeckCardCountBadge } from '@/components/deck/DeckCardCountBadge';
import { StatusKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { DeckQtyControl } from '@/components/deck/DeckQtyControl';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import type { DeckCard, DeckEntry } from '@/lib/deck-types';
import { openCard, type CardOpenSource } from '@/utils/cardNavigation';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

type DeckCardSlotVariant = 'card' | 'add' | 'empty' | 'identity';

interface DeckCardSlotProps {
  variant: DeckCardSlotVariant;
  tileWidth: number;
  stretch?: boolean;
  label?: string;
  card?: DeckCard;
  entry?: DeckEntry;
  imageUri?: string;
  owned?: number | null;
  illegal?: boolean;
  single?: boolean;
  openSource?: CardOpenSource;
  onPress?: () => void;
  onAdd?: () => void;
  onMinus?: () => void;
  onPlus?: () => void;
  onRemove?: () => void;
}

function DeckCardSlotInner({
  variant,
  tileWidth,
  stretch = false,
  label,
  card,
  entry,
  imageUri = '',
  owned = null,
  illegal = false,
  single = false,
  openSource,
  onPress,
  onAdd,
  onMinus,
  onPlus,
  onRemove,
}: DeckCardSlotProps) {
  const router = useRouter();
  const count = entry?.count ?? 1;
  const shortfall = owned != null && owned < count;
  const widthStyle = stretch ? undefined : { width: tileWidth };
  const stretchClass = stretch ? 'w-full min-w-0' : undefined;

  if (variant === 'add') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `Add ${label}` : 'Add card'}
        style={widthStyle}
        className={cn('gap-1.5 active:opacity-90', stretchClass)}
        onPress={() => {
          hapticPress();
          onAdd?.();
        }}
      >
        <View
          className={cn(
            'aspect-[5/7] w-full items-center justify-center border border-dashed border-border bg-card-panel',
            CARD_ART_RADIUS_CLASS
          )}
        >
          <View className="items-center gap-1">
            <ThemedIcon icon={PlusIcon} size={24} color="foreground" />
            <Text className="text-[11px] font-normal text-foreground">Add</Text>
          </View>
        </View>
        {label ? (
          <Text className="px-0.5 text-center text-[11px] text-muted-foreground">
            {label}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  if (variant === 'empty' || variant === 'identity') {
    const isIdentity = variant === 'identity';
    const isLocked = !onAdd && variant === 'empty';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} slot` : 'Empty slot'}
        accessibilityState={{ disabled: isLocked }}
        style={widthStyle}
        className={cn('gap-1.5', stretchClass, !isLocked && 'active:opacity-90')}
        onPress={() => {
          if (!onAdd) return;
          hapticPress();
          onAdd();
        }}
        disabled={!onAdd}
      >
        <View
          className={cn(
            'aspect-[5/7] w-full items-center justify-center border border-dashed bg-card-panel',
            CARD_ART_RADIUS_CLASS,
            isIdentity
              ? 'border-foreground'
              : isLocked
                ? 'border-border/60 opacity-60'
                : 'border-border'
          )}
        >
          <ThemedIcon
            icon={isIdentity ? StarIcon : isLocked ? LockIcon : PlusIcon}
            size={22}
            color={
              isLocked
                ? 'muted-foreground'
                : isIdentity
                  ? 'muted-foreground'
                  : 'foreground'
            }
          />
        </View>
        {label ? (
          <Text
            className={cn(
              'px-0.5 text-center text-[11px] font-normal',
              isLocked ? 'text-muted-foreground/80' : 'text-muted-foreground'
            )}
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  if (!card) return null;

  const showArtRemove = single && Boolean(onRemove);

  return (
    <View style={widthStyle} className={cn('gap-1.5', stretchClass)}>
      <View
        className={cn(
          'relative aspect-[5/7] w-full overflow-hidden border bg-background',
          CARD_ART_RADIUS_CLASS,
          illegal ? 'border-destructive' : 'border-border'
        )}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${card.name}`}
          className="absolute inset-0 active:opacity-90"
          onPress={() => {
            if (onPress) {
              hapticPress();
              onPress();
              return;
            }
            hapticPress();
            openCard(router, card.variantNumber, 'modal', openSource);
          }}
        >
          <DeckCardArt uri={imageUri} variantNumber={card.variantNumber} />
        </Pressable>

        {illegal ? (
          <View className="absolute left-1 top-1" pointerEvents="none">
            <StatusKeywordBadge status="illegal" compact />
          </View>
        ) : null}

        <CardArtInfoPreviewButton
          imageUri={imageUri}
          variantNumber={card.variantNumber}
          name={card.name}
        />

        {!showArtRemove ? <DeckCardCountBadge count={count} /> : null}

        {showArtRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${card.name}`}
            className="absolute bottom-1 left-1 z-10 size-7 items-center justify-center rounded-[3px] border border-border bg-background/92 active:bg-destructive/15"
            onPress={() => {
              hapticPress();
              onRemove?.();
            }}
          >
            <XIcon className="size-3.5 text-destructive" />
          </Pressable>
        ) : null}
      </View>

      <Text
        className={cn(
          'px-0.5 text-[12px] font-normal',
          illegal ? 'text-destructive' : 'text-foreground'
        )}
        numberOfLines={2}
      >
        {card.name}
      </Text>

      {owned != null ? (
        <Text
          className={cn(
            'px-0.5 font-mono text-[10px]',
            shortfall ? 'text-warning' : 'text-success'
          )}
        >
          Owned {Math.min(owned, count)}/{count}
        </Text>
      ) : null}

      {onRemove && !showArtRemove ? (
        <DeckQtyControl
          count={count}
          name={card.name}
          single={single}
          onMinus={onMinus}
          onPlus={onPlus}
          onRemove={onRemove}
        />
      ) : null}
    </View>
  );
}

function deckCardSlotPropsEqual(
  prev: DeckCardSlotProps,
  next: DeckCardSlotProps
): boolean {
  return (
    prev.variant === next.variant &&
    prev.tileWidth === next.tileWidth &&
    prev.stretch === next.stretch &&
    prev.label === next.label &&
    prev.imageUri === next.imageUri &&
    prev.owned === next.owned &&
    prev.illegal === next.illegal &&
    prev.single === next.single &&
    prev.openSource === next.openSource &&
    prev.card?.variantNumber === next.card?.variantNumber &&
    prev.entry?.count === next.entry?.count
  );
}

export const DeckCardSlot = memo(DeckCardSlotInner, deckCardSlotPropsEqual);
