import { View } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { CardBannedOverlay } from '@/components/riftbound/CardBannedOverlay';
import { StatusKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { RarityIcon } from '@/components/riftbound/CardIcons';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS, CATALOG_ART_THUMB_WIDTH } from '@/constants/CardArt';
import { cn } from '@/lib/utils';

interface CatalogDetailHeaderProps {
  cardName: string;
  isBanned: boolean;
  setCode: string;
  isDrawer: boolean;
  detailImageUri: string | null;
  activeVariantNumber: string;
  activeRarity: string;
  watchedElsewhereCount: number;
  variantFamilySwitcher: React.ReactNode;
  onOpenFullscreen: () => void;
}

export function CatalogDetailHeader({
  cardName,
  isBanned,
  setCode,
  isDrawer,
  detailImageUri,
  activeVariantNumber,
  activeRarity,
  watchedElsewhereCount,
  variantFamilySwitcher,
  onOpenFullscreen,
}: CatalogDetailHeaderProps) {
  return (
    <>
      <View className="flex-row gap-3 bg-card-panel p-3">
        <GesturePressable
          className="shrink-0 active:opacity-90 web:cursor-pointer"
          onPress={onOpenFullscreen}
          accessibilityRole="button"
          accessibilityLabel={`View ${cardName} full size`}
        >
          <View
            className={cn(
              'relative aspect-[5/7] w-[128px] overflow-hidden border',
              isBanned ? 'border-destructive/70' : 'border-white/10',
              CARD_ART_RADIUS_CLASS
            )}
          >
            <CardArtImage
              uri={detailImageUri}
              recyclingKey={activeVariantNumber}
              className="absolute inset-0"
              contentFit="contain"
              contentPosition="center"
              transition={isDrawer ? 0 : 200}
              thumbWidth={CATALOG_ART_THUMB_WIDTH}
              progressive
            />
            {isBanned ? <CardBannedOverlay /> : null}
          </View>
        </GesturePressable>

        <View className="min-w-0 flex-1 justify-center gap-1.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              className="text-xl font-semibold leading-tight tracking-tight text-foreground"
              numberOfLines={2}
            >
              {cardName}
            </Text>
            {isBanned ? <StatusKeywordBadge status="illegal" /> : null}
          </View>
          {isBanned ? (
            <Text className="text-xs text-destructive">Banned in tournament play.</Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {setCode ? (
              <>
                <Text className="font-mono text-xs text-muted-foreground">
                  {setCode}
                </Text>
                <Text className="text-xs text-muted-foreground">·</Text>
              </>
            ) : null}
            <RarityIcon rarity={activeRarity} size={14} />
            <Text className="text-xs font-medium text-muted-foreground">
              {activeRarity}
            </Text>
          </View>
          <Text className="font-mono text-xs text-archive-subtle">
            {activeVariantNumber}
          </Text>
          {watchedElsewhereCount > 0 ? (
            <Text className="text-xs font-medium text-foreground">
              Also on wishlist: {watchedElsewhereCount} other printing
              {watchedElsewhereCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          {!isDrawer ? variantFamilySwitcher : null}
        </View>
      </View>

      {isDrawer && variantFamilySwitcher ? (
        <View className="gap-2 border-t border-border px-3 pb-1 pt-2">
          {variantFamilySwitcher}
        </View>
      ) : null}
    </>
  );
}
