import { View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { ScanGuideOverlay } from '@/components/collection/ScanGuideOverlay';
import { Text } from '@/components/ui/text';
import { useCardArtIndex } from '@/hooks/useCardArtIndex';
import { useCardScannerFrame } from '@/hooks/useCardScannerFrame';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';
import { PREVIEW_ASPECT } from '@/utils/scanCrop';

/**
 * Frame engine surface. The preview asks for 60fps and Vision reads the same buffers
 * that feed it, so nothing ever interrupts the stream to take a picture.
 */
export function ScanCameraFrame({
  session,
  level,
  active,
}: {
  session: ScanSession;
  level: ScannerRecognitionLevel;
  active: boolean;
}) {
  const device = useCameraDevice('back');
  const { frameOutput, cardDetected, artDebug } = useCardScannerFrame(session, level);
  const artIndex = useCardArtIndex(session.items);
  // Scanning already works on text alone, so this is progress, not a blocker.
  const learning =
    artIndex.supported && !artIndex.ready && artIndex.total > 0
      ? ` · learning card art ${artIndex.done.toLocaleString()}/${artIndex.total.toLocaleString()}`
      : '';

  if (!device) {
    return (
      <View
        className="w-full items-center justify-center bg-card-panel"
        style={{ aspectRatio: PREVIEW_ASPECT }}
      >
        <Text className="text-sm text-muted-foreground">No camera available.</Text>
      </View>
    );
  }

  return (
    <View className="w-full" style={{ aspectRatio: PREVIEW_ASPECT }}>
      <Camera
        style={{ flex: 1 }}
        device={device}
        // Only the frame output. `<Camera>` creates its own preview output and
        // prepends it, so passing one here adds a second and the session rejects
        // the duplicate connection.
        outputs={[frameOutput]}
        // The 60Hz preview. Treated as a constraint, so a device that cannot hit it
        // negotiates down rather than failing to start.
        constraints={[{ fps: 60 }]}
        isActive={active}
        resizeMode="cover"
      />
      <ScanGuideOverlay
        locked={cardDetected}
        hint={
          !session.ready
            ? 'Loading catalog…'
            : session.justAdded
              ? `Added ${session.justAdded} — next card`
              : cardDetected
                ? `Card found — reading it${artDebug ? ` · ${artDebug}` : ''}`
                : `Show a card — it does not need to line up exactly${learning}`
        }
      />
    </View>
  );
}
