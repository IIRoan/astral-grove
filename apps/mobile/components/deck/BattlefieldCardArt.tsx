import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { CATALOG_ART_THUMB_WIDTH } from '@/constants/CardArt';

type BattlefieldCardArtProps = {
  uri: string;
  variantNumber: string;
};

export function BattlefieldCardArt({ uri, variantNumber }: BattlefieldCardArtProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  const { width, height } = layout;
  const ready = width > 0 && height > 0;

  return (
    <View
      className="absolute inset-0 items-center justify-center overflow-hidden"
      onLayout={onLayout}
    >
      {ready ? (
        <View
          style={{
            width: height,
            height: width,
            transform: [{ rotate: '90deg' }],
          }}
        >
          <CardArtImage
            uri={uri}
            recyclingKey={variantNumber}
            className="h-full w-full"
            contentFit="cover"
            contentPosition="center"
            transition={0}
            priority="high"
            thumbWidth={CATALOG_ART_THUMB_WIDTH}
            progressive
          />
        </View>
      ) : null}
    </View>
  );
}
