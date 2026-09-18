import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { Camera, useCameraDevice, type CameraRef } from 'react-native-vision-camera';
import { ScanGuideOverlay } from '@/components/collection/ScanGuideOverlay';
import { Text } from '@/components/ui/text';
import { useCardArtIndex } from '@/hooks/useCardArtIndex';
import { useCardScannerFrame } from '@/hooks/useCardScannerFrame';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';
import { PREVIEW_ASPECT, guideRect } from '@/utils/scanCrop';
import {
  scannerLowLightProps,
  supportsNativeScanQueue,
  torchOn,
  type TorchSetting,
} from '@/lib/scan-camera-support';
import { cardOcrFrame } from '@/modules/card-ocr-frame/src';
import { ScanCameraPhoto } from '@/components/collection/ScanCameraPhoto';

type ScanCameraFrameProps = {
  session: ScanSession;
  level: ScannerRecognitionLevel;
  active: boolean;
  torch: TorchSetting;
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
  const { frameOutput, cardDetected, lowLight, artDebug, scanError } =
    useCardScannerFrame(session, level, active && !session.pending);
  const lit = torchOn(torch, lowLight);

  const camera = useRef<CameraRef>(null);
  const preview = useRef({ width: 0, height: 0, started: false });
  // Expose and focus on the card rather than the table around it: a pale card on a
  // dark table otherwise meters bright and blows out, and on a bright one it sinks
  // into shadow. Continuous mode keeps tracking from that point as the light changes.
  const meterOnGuide = useCallback(() => {
    const { width, height, started } = preview.current;
    const ref = camera.current;
    const controller = ref?.controller;
    if (!ref || !controller || !started || width === 0) return;
    const guide = guideRect();
    try {
      const point = ref.createMeteringPoint(
        (guide.x + guide.width / 2) * width,
        (guide.y + guide.height / 2) * height,
        guide.width * width
      );
      controller
        .focusTo(point, { adaptiveness: 'continuous', autoResetAfter: null })
        .catch(() => undefined); // Metering can time out in the dark; defaults stay.
    } catch {
      // The preview is not up yet; the next start or layout tries again.
    }
  }, []);
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
        ref={camera}
        style={{ flex: 1 }}
        device={device}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          preview.current.width = width;
          preview.current.height = height;
          meterOnGuide();
        }}
        onPreviewStarted={() => {
          preview.current.started = true;
          meterOnGuide();
        }}
        onPreviewStopped={() => {
          preview.current.started = false;
        }}
        // Only the frame output. `<Camera>` creates its own preview output and
        // prepends it, so passing one here adds a second and the session rejects
        // the duplicate connection.
        outputs={[frameOutput]}
        constraints={[{ fps: 30 }]}
        {...scannerLowLightProps(device.supportsLowLightBoost)}
        torchMode={active && lit && device.hasTorch ? 'on' : 'off'}
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
                  : `Hold the card inside the guide${learning}${
                      lowLight && !lit ? ' · low light, try the light' : ''
                    }`
        }
      />
    </View>
  );
}
