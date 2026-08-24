import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { BattlefieldCardArt } from '@/components/deck/BattlefieldCardArt';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { Portal } from '@/components/ui/portal';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { cn } from '@/lib/utils';

const PORTRAIT_PREVIEW_HEIGHT = 460;
const PORTRAIT_PREVIEW_WIDTH = Math.round(PORTRAIT_PREVIEW_HEIGHT * (5 / 7));
const LANDSCAPE_PREVIEW_WIDTH = 560;
const LANDSCAPE_PREVIEW_HEIGHT = Math.round(LANDSCAPE_PREVIEW_WIDTH * (5 / 7));
const EDGE_PAD = 12;
const GAP = 10;

type Anchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CardArtHoverOrientation = 'portrait' | 'landscape';

interface CardArtHoverPreviewProps {
  imageUri: string;
  variantNumber: string;
  /** Battlefield cards render landscape (rotated art). */
  orientation?: CardArtHoverOrientation;
  children: ReactNode;
  className?: string;
}

/** Only one card-art hover preview should be visible at a time. */
let activeDismiss: (() => void) | null = null;

function claimHover(dismiss: () => void) {
  if (activeDismiss && activeDismiss !== dismiss) {
    activeDismiss();
  }
  activeDismiss = dismiss;
}

function releaseHover(dismiss: () => void) {
  if (activeDismiss === dismiss) {
    activeDismiss = null;
  }
}

/** Web-only portaled hover art (overflow-safe); aggressive cleanup avoids orphaned previews. */
export function CardArtHoverPreview({
  imageUri,
  variantNumber,
  orientation = 'portrait',
  children,
  className,
}: CardArtHoverPreviewProps) {
  const portalName = useId();
  const anchorRef = useRef<View>(null);
  const hoveringRef = useRef(false);
  const hoverSessionRef = useRef(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const hide = useCallback(() => {
    hoveringRef.current = false;
    hoverSessionRef.current += 1;
    releaseHover(hide);
    setAnchor(null);
  }, []);

  const measureAndShow = useCallback(() => {
    hoveringRef.current = true;
    const session = hoverSessionRef.current + 1;
    hoverSessionRef.current = session;
    claimHover(hide);

    anchorRef.current?.measureInWindow((x, y, width, height) => {
      // Ignore late measure results after leave / hide / newer enter.
      if (!hoveringRef.current || session !== hoverSessionRef.current) return;
      setAnchor({ x, y, width, height });
    });
  }, [hide]);

  // Unmount / image change must always clear.
  useEffect(() => {
    return () => {
      hide();
    };
  }, [hide, imageUri]);

  // While visible: dismiss on scroll/blur/tab-hide (mouseleave often misses list scroll).
  useEffect(() => {
    if (!anchor || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onScroll = () => {
      hide();
    };
    const onBlur = () => {
      hide();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') hide();
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [anchor, hide]);

  if (Platform.OS !== 'web' || !imageUri) {
    return <>{children}</>;
  }

  const baseWidth =
    orientation === 'landscape' ? LANDSCAPE_PREVIEW_WIDTH : PORTRAIT_PREVIEW_WIDTH;
  const baseHeight =
    orientation === 'landscape' ? LANDSCAPE_PREVIEW_HEIGHT : PORTRAIT_PREVIEW_HEIGHT;
  const maxWidth = Math.max(160, windowWidth - EDGE_PAD * 2);
  const maxHeight = Math.max(200, windowHeight - EDGE_PAD * 2);
  const fitScale = Math.min(1, maxWidth / baseWidth, maxHeight / baseHeight);
  const previewWidth = Math.round(baseWidth * fitScale);
  const previewHeight = Math.round(baseHeight * fitScale);

  let previewLeft = 0;
  let previewTop = 0;
  if (anchor) {
    const rightSpace = windowWidth - (anchor.x + anchor.width) - EDGE_PAD;
    const leftSpace = anchor.x - EDGE_PAD;
    if (rightSpace >= previewWidth + GAP) {
      previewLeft = anchor.x + anchor.width + GAP;
    } else if (leftSpace >= previewWidth + GAP) {
      previewLeft = anchor.x - previewWidth - GAP;
    } else {
      previewLeft = Math.max(
        EDGE_PAD,
        Math.min(
          anchor.x + anchor.width / 2 - previewWidth / 2,
          windowWidth - previewWidth - EDGE_PAD
        )
      );
    }

    previewTop = Math.max(
      EDGE_PAD,
      Math.min(
        anchor.y + anchor.height / 2 - previewHeight / 2,
        windowHeight - previewHeight - EDGE_PAD
      )
    );
  }

  return (
    <View
      ref={anchorRef}
      className={cn('relative', className)}
      {...({
        onMouseEnter: measureAndShow,
        onMouseLeave: hide,
        onPointerEnter: measureAndShow,
        onPointerLeave: hide,
      } as object)}
    >
      {children}
      {anchor ? (
        <Portal name={`card-art-hover-${portalName}`}>
          <View
            pointerEvents="none"
            style={{
              position: 'fixed',
              left: previewLeft,
              top: previewTop,
              width: previewWidth,
              zIndex: 50,
            }}
          >
            <View
              className={cn(
                'overflow-hidden border border-border bg-background shadow-none',
                CARD_ART_RADIUS_CLASS
              )}
              style={{ width: previewWidth, height: previewHeight }}
            >
              {orientation === 'landscape' ? (
                <BattlefieldCardArt uri={imageUri} variantNumber={variantNumber} />
              ) : (
                <DeckCardArt uri={imageUri} variantNumber={variantNumber} />
              )}
            </View>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}
