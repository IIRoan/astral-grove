import { memo } from 'react';
import { View } from 'react-native';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { CATALOG_ART_THUMB_WIDTH } from '@/constants/CardArt';
import { cn } from '@/lib/utils';

type DeckCardArtProps = {
  uri: string;
  variantNumber: string;
  fit?: 'contain' | 'cover';
  thumbWidth?: number;
};

function DeckCardArtInner({
  uri,
  variantNumber,
  fit = 'contain',
  thumbWidth = CATALOG_ART_THUMB_WIDTH,
}: DeckCardArtProps) {
  const cover = fit === 'cover';

  return (
    <View
      className={cn(
        'absolute inset-0',
        cover ? undefined : 'items-center justify-center p-1'
      )}
    >
      <CardArtImage
        uri={uri}
        recyclingKey={variantNumber}
        className="h-full w-full"
        contentFit={cover ? 'cover' : 'contain'}
        contentPosition={cover ? 'top' : 'center'}
        transition={0}
        priority="high"
        instant
        thumbWidth={thumbWidth}
        progressive
      />
    </View>
  );
}

export const DeckCardArt = memo(
  DeckCardArtInner,
  (prev, next) =>
    prev.uri === next.uri &&
    prev.variantNumber === next.variantNumber &&
    prev.fit === next.fit &&
    prev.thumbWidth === next.thumbWidth
);
