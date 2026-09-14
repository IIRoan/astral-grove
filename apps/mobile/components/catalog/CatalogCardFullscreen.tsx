import { useLayoutEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { Portal, PortalOverlay } from '@/components/ui/portal';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { logDrawer } from '@/lib/drawer-debug';
import { fitAspectBox } from '@/lib/responsive-layout';
import { suppressSheetDismiss } from '@/lib/sheet-dismiss-guard';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { cn } from '@/lib/utils';

const FULLSCREEN_GUTTER = 16;

interface CatalogCardFullscreenProps {
  visible: boolean;
  imageUrl: string;
  name: string;
  onClose: () => void;
}

export function CatalogCardFullscreen({
  visible,
  imageUrl,
  name: _name,
  onClose,
}: CatalogCardFullscreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wasVisibleRef = useRef(false);

  useLayoutEffect(() => {
    if (visible) {
      logDrawer('fullscreen.open', { platform: Platform.OS });
    } else if (wasVisibleRef.current) {
      logDrawer('fullscreen.close', { platform: Platform.OS });
      suppressSheetDismiss();
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  if (!visible) return null;

  // Bound by both axes (minus safe area + a 16pt gutter) so narrow phones never crop the card.
  const { width: cardWidth, height: cardHeight } = fitAspectBox(
    windowWidth - insets.left - insets.right - FULLSCREEN_GUTTER * 2,
    Math.min(
      windowHeight * 0.88,
      windowHeight - insets.top - insets.bottom - FULLSCREEN_GUTTER * 2,
      560
    ),
    5 / 7
  );

  return (
    <Portal name="catalog-card-fullscreen">
      <PortalOverlay>
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
          className="items-center justify-center bg-black/85"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              logDrawer('fullscreen.dismiss', { platform: Platform.OS });
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close full size card"
          />
          <CardArtImage
            uri={resolveImageUrl(imageUrl)}
            recyclingKey={imageUrl}
            className={cn('relative z-10', CARD_ART_RADIUS_CLASS)}
            style={{ width: cardWidth, height: cardHeight }}
            contentFit="contain"
            contentPosition="center"
          />
        </View>
      </PortalOverlay>
    </Portal>
  );
}
