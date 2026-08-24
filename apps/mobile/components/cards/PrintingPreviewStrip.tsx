import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { formatPrintingLabel, isFoilVariant } from '@/utils/variants';

export interface PrintingPreviewItem {
  id: string;
  variantNumber: string;
  variantLabel: string;
  variantType?: string;
  imageUrl: string;
  price?: string | null;
}

interface Props {
  items: PrintingPreviewItem[];
  selectedId: string;
  onSelect: (variantNumber: string) => void;
  compact?: boolean;
  dense?: boolean;
}

export function PrintingPreviewStrip({
  items,
  selectedId,
  onSelect,
  compact = false,
  dense = false,
}: Props) {
  const thumbWidth = compact ? 44 : 56;
  const thumbHeight = compact ? 62 : 78;

  const renderItem = useCallback<ListRenderItem<PrintingPreviewItem>>(
    ({ item }) => {
      const foil = isFoilVariant(
        item.variantNumber,
        item.variantLabel,
        item.variantType
      );
      const selected = item.variantNumber === selectedId;
      const title = formatPrintingLabel(item.variantLabel, foil, item.variantNumber);
      return (
        <Pressable
          className="max-w-[72px] items-center gap-1 active:opacity-80"
          onPress={() => {
            onSelect(item.variantNumber);
          }}
        >
          <Image
            key={item.variantNumber}
            recyclingKey={item.variantNumber}
            source={{ uri: resolveImageUrl(item.imageUrl) }}
            style={{ width: thumbWidth, height: thumbHeight }}
            className={cn(
              'border-2 bg-card',
              CARD_ART_RADIUS_CLASS,
              selected ? 'border-foreground' : 'border-transparent'
            )}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <Text
            className="w-[72px] text-center text-[9px] font-semibold text-muted-foreground"
            numberOfLines={1}
          >
            {title}
          </Text>
          {item.price ? (
            <Text
              className="text-center text-[9px] font-bold text-success"
              numberOfLines={1}
            >
              {item.price}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [onSelect, selectedId, thumbHeight, thumbWidth]
  );

  if (items.length <= 1) return null;

  return (
    <View className={dense ? 'gap-1' : 'gap-2'}>
      <SectionLabel className={dense ? 'mb-0.5' : undefined}>Printings</SectionLabel>
      <FlashList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2.5 pr-1"
      />
    </View>
  );
}
