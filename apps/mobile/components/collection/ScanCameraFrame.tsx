import { View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { ScanGuideOverlay } from '@/components/collection/ScanGuideOverlay';
import { Text } from '@/components/ui/text';
import { useCardArtIndex } from '@/hooks/useCardArtIndex';
import { useCardScannerFrame } from '@/hooks/useCardScannerFrame';
import type { ScanSession } from '@/hooks/useScanSession';
import { PREVIEW_ASPECT } from '@/utils/scanCrop';
import {
  scannerLowLightProps,
  supportsNativeScanQueue,
} from '@/lib/scan-camera-support';
import { cardOcrFrame } from '@/modules/card-ocr-frame/src';

type ScanCameraFrameProps = {
  session: ScanSession;
  active: boolean;
  torch: boolean;
};

export function ScanCameraFrame(props: ScanCameraFrameProps) {
  // Metro can serve newer JS to an installed binary that has no artwork matching.
  return supportsNativeScanQueue(cardOcrFrame) ? (
    <NativeScanCameraFrame {...props} />
  ) : (
    <Placeholder message="Update the app to scan cards." />
  );
}

/** A 30fps target gives auto-exposure more room in dim light. */
function NativeScanCameraFrame({ session, active, torch }: ScanCameraFrameProps) {
  const device = useCameraDevice('back');
  const artIndex = useCardArtIndex();
  const { frameOutput, cardDetected, leading, scanDebug, scanError } =
    useCardScannerFrame(session, active && artIndex.ready && !session.pending);

  if (!device) return <Placeholder message="No camera available." />;

  return (
    <View className="w-full" style={{ aspectRatio: PREVIEW_ASPECT }}>
      <Camera
        style={{ flex: 1 }}
        device={device}
        // Only the frame output. `<Camera>` creates its own preview output and
        // prepends it, so passing one here adds a second and the session rejects
        // the duplicate connection.
        outputs={[frameOutput]}
        constraints={[{ fps: 30 }]}
        {...scannerLowLightProps(device.supportsLowLightBoost)}
        torchMode={active && torch && device.hasTorch ? 'on' : 'off'}
        isActive={active}
        resizeMode="cover"
        enableNativeTapToFocusGesture
      />
      <ScanGuideOverlay
        locked={cardDetected}
        leading={leading}
        hint={scanHint({
          scanError,
          catalogReady: session.ready,
          indexError: artIndex.error,
          indexReady: artIndex.ready,
          justAdded: session.justAdded,
          cardDetected,
          scanDebug,
        })}
      />
    </View>
  );
}

function scanHint({
  scanError,
  catalogReady,
  indexError,
  indexReady,
  justAdded,
  cardDetected,
  scanDebug,
}: {
  scanError: boolean;
  catalogReady: boolean;
  indexError: string | null;
  indexReady: boolean;
  justAdded: string | null;
  cardDetected: boolean;
  scanDebug: string;
}): string {
  if (scanError) return 'Camera could not read this frame. Retrying…';
  if (indexError) return indexError;
  if (!catalogReady || !indexReady) return 'Preparing card index…';
  if (justAdded) return `Added ${justAdded} — next card`;
  if (cardDetected) return `Matching${scanDebug ? ` · ${scanDebug}` : ''}`;
  return 'Hold a card inside the guide — tap to focus';
}

function Placeholder({ message }: { message: string }) {
  return (
    <View
      className="w-full items-center justify-center bg-card-panel"
      style={{ aspectRatio: PREVIEW_ASPECT }}
    >
      <Text className="text-sm text-muted-foreground">{message}</Text>
    </View>
  );
}
