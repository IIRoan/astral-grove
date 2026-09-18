import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import { useLatestRef } from '@/hooks/useLatestRef';
import { scheduleOnRN } from 'react-native-worklets';
import { cardOcrFrame, type FrameScanOptions } from '@/modules/card-ocr-frame/src';
import { cardRect, toVisionRegion, previewRegionToFrameRegion } from '@/utils/scanCrop';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';

/** Allow exposure to settle between passes; recognition runs on a separate worker. */
const SCAN_IDLE_MS = 80;

/** Native footer rectification target. */
const RECTIFIED_WIDTH = 1200;
// Capture real extra detail for the footer; enlarging a 720p frame cannot restore it.
const SCAN_RESOLUTION = { width: 1920, height: 1080 };

/**
 * Frame engine: Apple Vision locates the card and reads only its collector footer, all
 * on the camera's pixel buffer, using a separate worker so delivery can continue.
 */
export function useCardScannerFrame(
  session: ScanSession,
  level: ScannerRecognitionLevel,
  enabled: boolean
) {
  const { resolve, present, noteCard } = session;
  const [scanError, setScanError] = useState(false);
  const lastError = useRef<string | null>(null);
  const enabledRef = useLatestRef(enabled);
  const scanning = useSharedValue(enabled);
  useEffect(() => {
    cardOcrFrame.resetScan();
    scanning.value = enabled;
    return () => {
      scanning.value = false;
      cardOcrFrame.resetScan();
    };
  }, [enabled, scanning]);
  // Shared values, not refs: the worklet runs off the JS thread and needs state that
  // survives between frames on its own runtime.
  const lastScanEnd = useSharedValue(0);
  const [cardDetected, setCardDetected] = useState(false);
  /** Stage timings for physical-device performance checks, dev builds only. */
  const [scanDebug, setScanDebug] = useState('');

  // Called back on the JS thread once a frame has been read.
  const handleResult = useCallback(
    (lines: string[][], detected: boolean, stageMs: number[]) => {
      if (!enabledRef.current) return;
      lastError.current = null;
      setScanError(false);
      setCardDetected(detected);
      noteCard(detected);
      if (__DEV__) {
        const timing = stageMs.length > 0 ? `${stageMs.join('+')}ms` : '';
        setScanDebug(timing);
      }
      const outcome = resolve(lines);
      if (outcome) present(outcome);
    },
    [enabledRef, noteCard, present, resolve]
  );

  const options = useMemo(() => {
    const guide = toVisionRegion(cardRect());
    return {
      recognitionLevel: level,
      usesLanguageCorrection: false,
      rectifiedWidth: RECTIFIED_WIDTH,
      maxCandidates: 3,
      regionX: guide.x,
      regionY: guide.y,
      regionWidth: guide.width,
      regionHeight: guide.height,
    } satisfies Omit<FrameScanOptions, 'orientation' | 'wholeCard'>;
  }, [level]);

  const handleError = useCallback(
    (message: string) => {
      if (!enabledRef.current) return;
      if (lastError.current !== message) console.warn(`Card recognition: ${message}`);
      lastError.current = message;
      setScanError(true);
    },
    [enabledRef]
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    targetResolution: SCAN_RESOLUTION,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      try {
        if (!scanning.value || performance.now() - lastScanEnd.value < SCAN_IDLE_MS)
          return;
        const result = cardOcrFrame.pollScan(frame, {
          ...options,
          ...previewRegionToFrameRegion(options, frame),
          orientation: frame.orientation,
          wholeCard: false,
        });
        if (!result) return;
        lastScanEnd.value = performance.now();
        scheduleOnRN(
          handleResult,
          result.lines,
          result.cardDetected,
          [result.locateMs, result.readMs].map(Math.round)
        );
      } catch (error) {
        lastScanEnd.value = performance.now();
        scheduleOnRN(
          handleError,
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        // The native queue retains only the accepted pixel buffer, never this JS Frame.
        frame.dispose();
      }
    },
  });

  return { frameOutput, cardDetected, scanDebug, scanError };
}
