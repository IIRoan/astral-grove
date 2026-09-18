import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CameraView } from 'expo-camera';
import { ScanGuideOverlay } from '@/components/collection/ScanGuideOverlay';
import { useCardScannerPhoto } from '@/hooks/useCardScannerPhoto';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';
import { PREVIEW_ASPECT } from '@/utils/scanCrop';
import type { TorchSetting } from '@/lib/scan-camera-support';

/**
 * Photo engine surface. The preview is pinned to a fixed aspect ratio because the crop
 * maths maps preview coordinates onto the captured photo — see `utils/scanCrop`.
 */
export function ScanCameraPhoto({
  session,
  level,
  active,
  torch,
}: {
  session: ScanSession;
  level: ScannerRecognitionLevel;
  active: boolean;
  torch: TorchSetting;
}) {
  const cameraRef = useRef<CameraView | null>(null);
  const [ready, setReady] = useState(false);
  const { runPass, passGapMs } = useCardScannerPhoto(session, level);

  const looping = active && ready && session.ready && !session.pending;
  useEffect(() => {
    if (!looping) return;
    let cancelled = false;

    const tick = async () => {
      await runPass(cameraRef.current);
      if (!cancelled) timer = setTimeout(() => void tick(), passGapMs);
    };

    let timer = setTimeout(() => void tick(), passGapMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [looping, passGapMs, runPass]);

  return (
    <View className="w-full" style={{ aspectRatio: PREVIEW_ASPECT }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        active={active}
        // No light meter on this engine, so `auto` stays off.
        enableTorch={active && torch === 'on'}
        animateShutter={false}
        onCameraReady={() => setReady(true)}
      />
      <ScanGuideOverlay
        hint={
          session.ready
            ? 'Fill the frame — the code reads from the bottom edge'
            : 'Loading catalog…'
        }
      />
    </View>
  );
}
