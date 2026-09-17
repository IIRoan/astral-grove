import { View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { ScanGuideOverlay } from '@/components/collection/ScanGuideOverlay';
import { Text } from '@/components/ui/text';
import { useCardArtIndex } from '@/hooks/useCardArtIndex';
import { useCardScannerFrame } from '@/hooks/useCardScannerFrame';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';
import { PREVIEW_ASPECT } from '@/utils/scanCrop';
import {
  scannerLowLightProps,
  supportsNativeScanQueue,
} from '@/lib/scan-camera-support';
import { cardOcrFrame } from '@/modules/card-ocr-frame/src';
import { ScanCameraPhoto } from '@/components/collection/ScanCameraPhoto';

type ScanCameraFrameProps = {
  session: ScanSession;
  level: ScannerRecognitionLevel;
  active: boolean;
  torch: boolean;
};

export function ScanCameraFrame(props: ScanCameraFrameProps) {
  // Metro can serve newer JS to an installed binary; keep scanning with local photo OCR.
  return supportsNativeScanQueue(cardOcrFrame) ? (
    <NativeScanCameraFrame {...props} />
  ) : (
    <ScanCameraPhoto {...props} />
  );
}

/** A 30fps target gives auto-exposure more room in dim light. */
function NativeScanCameraFrame({
  session,
  level,
  active,
  torch,
}: ScanCameraFrameProps) {
  const device = useCameraDevice('back');
  const { frameOutput, cardDetected, artDebug, scanError } = useCardScannerFrame(
    session,
    level,
    active && !session.pending
  );
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
        constraints={[{ fps: 30 }]}
        {...scannerLowLightProps(device.supportsLowLightBoost)}
        torchMode={active && torch && device.hasTorch ? 'on' : 'off'}
        isActive={active}
        resizeMode="cover"
      />
      <ScanGuideOverlay
        locked={cardDetected}
        hint={
          scanError
            ? 'Camera could not read this frame. Retrying…'
            : !session.ready
              ? 'Loading catalog…'
              : session.justAdded
                ? `Added ${session.justAdded} — next card`
                : cardDetected
                  ? `Card found — reading it${artDebug ? ` · ${artDebug}` : ''}`
                  : `Hold the card inside the guide${learning}`
        }
      />
    </View>
  );
}
