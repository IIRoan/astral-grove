import { ThemedIcon, ImageIcon } from '@/components/icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { BattlefieldCardArt } from '@/components/deck/BattlefieldCardArt';
import { CardArtInfoPreviewButton } from '@/components/deck/CardArtInfoPreviewButton';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { GridDeckControl } from '@/components/deck/GridDeckControl';
import { StatusKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import type { DeckCard } from '@/lib/deck-types';
import { deckOwnershipBorderClass } from '@/lib/deck-validation';
import { hapticPress } from '@/utils/haptics';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { cn } from '@/lib/utils';

export interface DeckCatalogGridTileProps {
  tileWidth: number;
  candidate: DeckCard;
  count: number;
  owned?: number | null;
  blocked?: boolean;
  blockedLabel?: string;
  illegal?: boolean;
  readOnly?: boolean;
  selected?: boolean;
  horizontal?: boolean;
  canAdd?: boolean;
  canRemove?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onOpenCard: () => void;
}

export const DeckCatalogGridTile = memo(function DeckCatalogGridTile({
  tileWidth,
  candidate,
  count,
  owned = null,
  blocked = false,
  blockedLabel = 'Unavailable',
  illegal = false,
  readOnly = false,
  selected = false,
  horizontal = false,
  canAdd: canAddProp,
  canRemove: canRemoveProp,
  onAdd,
  onRemove,
  onOpenCard,
}: DeckCatalogGridTileProps) {
  const canAdd = canAddProp ?? (!readOnly && !blocked);
  const canRemove = canRemoveProp ?? (!readOnly && count > 0);
  const ownershipBorder = deckOwnershipBorderClass(owned, count);
  const imageUri = candidate.imageUrl ? resolveImageUrl(candidate.imageUrl) : '';
  const inDeck = selected || count > 0;
  const shortfall = owned != null && count > 0 && owned < count;
  const showControl = !readOnly || count > 0;

  const handleOpenCard = () => {
    void hapticPress();
    onOpenCard();
  };

  return (
    <View
      className={cn(
        'overflow-hidden border bg-card',
        CARD_ART_RADIUS_CLASS,
        illegal
          ? 'border-destructive/70'
          : inDeck
            ? 'border-foreground'
            : blocked
              ? 'border-border/70'
              : 'border-border'
      )}
      style={{ width: tileWidth }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${candidate.name}`}
        className="active:opacity-95"
        onPress={handleOpenCard}
      >
        <View
          className={cn(
            'relative w-full overflow-hidden bg-card-panel',
            horizontal ? 'aspect-[7/5]' : 'aspect-[5/7]',
            ownershipBorder ? `border-b-2 ${ownershipBorder}` : ''
          )}
        >
          {imageUri ? (
            horizontal ? (
              <BattlefieldCardArt
                uri={imageUri}
                variantNumber={candidate.variantNumber}
              />
            ) : (
              <DeckCardArt uri={imageUri} variantNumber={candidate.variantNumber} />
            )
          ) : (
            <View className="flex-1 items-center justify-center bg-card-panel">
              <ThemedIcon icon={ImageIcon} size={20} color="muted-foreground" />
            </View>
          )}

          {illegal ? (
            <View className="absolute left-1 top-1" pointerEvents="none">
              <StatusKeywordBadge status="illegal" compact />
            </View>
          ) : null}

          <CardArtInfoPreviewButton
            imageUri={imageUri}
            variantNumber={candidate.variantNumber}
            name={candidate.name}
            orientation={horizontal ? 'landscape' : 'portrait'}
          />
        </View>
      </Pressable>

      <View className="gap-2 border-t border-border bg-card-panel px-2.5 py-2.5">
        <Pressable onPress={handleOpenCard} accessibilityRole="button">
          {/* Fixed 2-line title + meta row so Add CTAs align across the grid. */}
          <View className="gap-0.5">
            <Text
              className={cn(
                'h-8 text-[13px] font-semibold leading-4',
                illegal ? 'text-destructive' : 'text-foreground'
              )}
              numberOfLines={2}
            >
              {candidate.name}
            </Text>
            <View className="h-4 flex-row items-center justify-between gap-2">
              {owned != null && count > 0 ? (
                <Text
                  className={cn(
                    'font-mono text-[12px] font-semibold tabular-nums',
                    shortfall ? 'text-warning' : 'text-success'
                  )}
                >
                  Own {Math.min(owned, count)}/{count}
                </Text>
              ) : (
                <Text
                  className="font-mono text-[12px] font-semibold tabular-nums text-muted-foreground"
                  numberOfLines={1}
                >
                  {candidate.variantNumber}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
        {showControl ? (
          <GridDeckControl
            count={count}
            name={candidate.name}
            canAdd={canAdd}
            canRemove={canRemove}
            blocked={blocked}
            blockedLabel={blockedLabel}
            readOnly={readOnly}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ) : null}
      </View>
    </View>
  );
});
