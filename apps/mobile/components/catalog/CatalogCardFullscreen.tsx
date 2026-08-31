import { useLayoutEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { Portal, PortalOverlay } from '@/components/ui/portal';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { logDrawer } from '@/lib/drawer-debug';
import { suppressSheetDismiss } from '@/lib/sheet-dismiss-guard';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { cn } from '@/lib/utils';

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
  const { height: windowHeight } = useWindowDimensions();
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

  const cardHeight = Math.min(windowHeight * 0.88, 560);
  const cardWidth = cardHeight * (5 / 7);

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
