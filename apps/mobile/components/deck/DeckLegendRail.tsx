import { ThemedIcon, StarIcon } from '@/components/icons';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { CardArtHoverPreview } from '@/components/deck/CardArtHoverPreview';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { legendListArtLayout } from '@/lib/legend-list-art';
import { cn } from '@/lib/utils';

export const LEGEND_RAIL_WIDE = 300;
export const LEGEND_RAIL_NARROW = 120;
export const LEGEND_GRID_BANNER = 168;
export const LEGEND_CROP_THUMB_WIDTH = 480;
export const LEGEND_RAIL_MIN_HEIGHT_WIDE = 232;
export const LEGEND_RAIL_MIN_HEIGHT_NARROW = 168;

export function DeckLegendPortrait({
  imageUri,
  variantNumber,
  fallbackIcon = false,
  width,
  height,
  fill = false,
  crop = true,
  fade = 'none',
}: {
  imageUri: string;
  variantNumber?: string;
  fallbackIcon?: boolean;
  width: number;
  height?: number;
  fill?: boolean;
  crop?: boolean;
  fade?: 'none' | 'right' | 'bottom';
}) {
  const [clip, setClip] = useState({
    width,
    height: height ?? (fill ? LEGEND_RAIL_MIN_HEIGHT_WIDE : 0),
  });
  const railWidth = fill ? clip.width : width;
  const railHeight = fill ? clip.height : (height ?? clip.height);
  const layout = crop ? legendListArtLayout(railWidth, railHeight) : null;

  const thumb = (
    <View
      className={cn('overflow-hidden bg-background', fill && 'h-full w-full')}
      style={{ width, height: height ?? (fill ? undefined : 0) }}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextWidth <= 0 || nextHeight <= 0) return;
        if (nextWidth === clip.width && nextHeight === clip.height) return;
        setClip({ width: nextWidth, height: nextHeight });
      }}
    >
      {imageUri && variantNumber && (!crop || (layout && layout.cardWidth > 0)) ? (
        crop && layout ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: layout.offsetY,
              left: layout.offsetX,
              width: layout.cardWidth,
              height: layout.cardHeight,
            }}
          >
            <DeckCardArt
              uri={imageUri}
              variantNumber={variantNumber}
              fit="cover"
              thumbWidth={LEGEND_CROP_THUMB_WIDTH}
            />
          </View>
        ) : (
          <DeckCardArt
            uri={imageUri}
            variantNumber={variantNumber}
            fit="contain"
            thumbWidth={LEGEND_CROP_THUMB_WIDTH}
          />
        )
      ) : (
        <View className="flex-1 items-center justify-center bg-card-panel">
          {fallbackIcon ? (
            <ThemedIcon icon={StarIcon} size={18} color="muted-foreground" />
          ) : null}
        </View>
      )}
      {crop && fade === 'right' && Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          className="absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent to-card"
        />
      ) : null}
      {crop && fade === 'bottom' && Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent"
        />
      ) : null}
    </View>
  );

  if (!imageUri || !variantNumber) return thumb;

  return (
    <CardArtHoverPreview
      imageUri={imageUri}
      variantNumber={variantNumber}
      className={fill ? 'h-full w-full' : undefined}
    >
      {thumb}
    </CardArtHoverPreview>
  );
}
