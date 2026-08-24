import { Pressable, View, type ViewStyle } from 'react-native';
import type { CardListItem } from '@riftbound/contracts';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { CardBannedOverlay } from '@/components/riftbound/CardBannedOverlay';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS, CATALOG_ART_THUMB_WIDTH } from '@/constants/CardArt';
import {
  CARD_TILE_PRICE_CLASS,
  CARD_TILE_TITLE_CLASS,
  CARD_TILE_VARIANT_CLASS,
} from '@/constants/operateType';
import { cn } from '@/lib/utils';

export interface CardTileGridLayoutProps {
  card: CardListItem;
  style?: ViewStyle;
  imageUri: string | null;
  banned: boolean;
  selected: boolean;
  artInstant: boolean;
  isMobile: boolean;
  primaryPrinting?: CardListItem['printings'][number];
  showPrice: boolean;
  priceLabel: string | null;
  gridControl: React.ReactNode;
  onOpenCard: () => void;
}

export function CardTileGridLayout({
  card,
  style,
  imageUri,
  banned,
  selected,
  artInstant,
  isMobile,
  primaryPrinting,
  showPrice,
  priceLabel,
  gridControl,
  onOpenCard,
}: CardTileGridLayoutProps) {
  return (
    <View
      className={cn(
        'overflow-hidden border bg-card',
        CARD_ART_RADIUS_CLASS,
        banned
          ? 'border-destructive/70'
          : selected
            ? 'border-foreground'
            : 'border-border'
      )}
      style={style}
    >
      <Pressable
        className="active:opacity-95"
        onPress={onOpenCard}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={card.name}
      >
        <View className="relative aspect-[5/7] w-full overflow-hidden bg-card-panel">
          <CardArtImage
            uri={imageUri}
            recyclingKey={card.variantNumber}
            className="absolute inset-0"
            contentFit="cover"
            contentPosition="top"
            instant={artInstant || isMobile}
            thumbWidth={CATALOG_ART_THUMB_WIDTH}
            progressive
          />
          {banned ? <CardBannedOverlay /> : null}
        </View>
      </Pressable>

      <View className="gap-1.5 border-t border-border bg-card-panel px-2 py-2">
        <Pressable onPress={onOpenCard} accessibilityRole="button">
          {/* Fixed title + meta heights keep grid CTAs aligned across the row. */}
          <Text className={CARD_TILE_TITLE_CLASS} numberOfLines={1}>
            {card.name}
          </Text>
          <View className="mt-0.5 h-4 flex-row items-center gap-1">
            {showPrice ? (
              <Text className={CARD_TILE_PRICE_CLASS} numberOfLines={1}>
                {priceLabel ?? '—'}
              </Text>
            ) : (
              <View className="min-w-0 flex-1" />
            )}
            <Text className={CARD_TILE_VARIANT_CLASS} numberOfLines={1}>
              {primaryPrinting?.variantNumber}
            </Text>
          </View>
        </Pressable>
        {gridControl}
      </View>
    </View>
  );
}
