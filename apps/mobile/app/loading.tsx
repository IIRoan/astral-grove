import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RUNE_SIZE_PX,
  type RuneChargeSize,
} from '@/components/riftbound/RuneChargeLoader';
import { AppLoader, AppLoadingOverlay } from '@/components/ui/app-loader';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { runeSizeForWindow } from '@/lib/rune-size';
import { cn } from '@/lib/utils';

const SIZES: RuneChargeSize[] = ['sm', 'md', 'lg', 'xl'];

/** Design playground: boot-scale rune on a full phone field. */
export default function LoadingPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const autoSize = runeSizeForWindow(width, height);
  const [selectedSize, setSelectedSize] = useState<RuneChargeSize | 'auto'>('auto');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const stageSize = selectedSize === 'auto' ? autoSize : selectedSize;

  useEffect(() => {
    if (!overlayOpen) return;
    const timer = setTimeout(() => setOverlayOpen(false), 2800);
    return () => clearTimeout(timer);
  }, [overlayOpen]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use auto size for this screen"
            onPress={() => setSelectedSize('auto')}
            className={cn(
              'rounded-[3px] border px-3 py-2',
              selectedSize === 'auto'
                ? 'border-foreground bg-card-panel'
                : 'border-border bg-card'
            )}
          >
            <Text
              className={cn(
                'font-mono text-[11px] uppercase tracking-wide',
                selectedSize === 'auto' ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              auto
            </Text>
          </Pressable>
          {SIZES.map((size) => (
            <Pressable
              key={size}
              accessibilityRole="button"
              accessibilityLabel={`Use ${size} rune size`}
              onPress={() => setSelectedSize(size)}
              className={cn(
                'rounded-[3px] border px-3 py-2',
                selectedSize === size
                  ? 'border-foreground bg-card-panel'
                  : 'border-border bg-card'
              )}
            >
              <Text
                className={cn(
                  'font-mono text-[11px] uppercase tracking-wide',
                  selectedSize === size ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {size}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="grow items-center justify-center gap-4 py-4">
          <AppLoader size={stageSize} />
          <Text className="font-mono text-[11px] text-muted-foreground">
            {selectedSize === 'auto'
              ? `AUTO · ${autoSize.toUpperCase()}`
              : stageSize.toUpperCase()}{' '}
            · {RUNE_SIZE_PX[stageSize]}px
          </Text>
        </View>

        <View className="w-full max-w-[400px] self-center gap-3">
          <Button onPress={() => setOverlayOpen(true)}>
            <ButtonText>Preview overlay</ButtonText>
          </Button>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
            onPress={() => router.back()}
            className="items-center py-3 active:opacity-70"
          >
            <Text className="text-base font-medium text-foreground">Back</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AppLoadingOverlay
        visible={overlayOpen}
        onRequestClose={() => setOverlayOpen(false)}
      />
    </View>
  );
}
