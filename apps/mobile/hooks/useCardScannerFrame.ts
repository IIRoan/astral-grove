import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import { useLatestRef } from '@/hooks/useLatestRef';
import { scheduleOnRN } from 'react-native-worklets';
import type { ArtMatch, CardListItem } from '@riftbound/contracts';
import { cardOcrFrame, type FrameScanOptions } from '@/modules/card-ocr-frame/src';
import { cardRect, toVisionRegion, previewRegionToFrameRegion } from '@/utils/scanCrop';
import type { ScanSession } from '@/hooks/useScanSession';

/**
 * The card is located and described at a few hundred pixels, so a 720p buffer holds
 * every pixel the descriptor can use and converts in a fraction of the time 1080p does.
 */
const SCAN_RESOLUTION = { width: 1280, height: 720 };

/**
 * Apple Vision locates the card and the native matcher describes it and searches the
 * art index, all on the camera's own pixel buffer and on a separate worker so frame
 * delivery never waits.
 */
export function useCardScannerFrame(session: ScanSession, enabled: boolean) {
  const { resolve, identify, present, noteCard } = session;
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
  const [cardDetected, setCardDetected] = useState(false);
  /** The card the frame currently looks most like, shown live before it is offered. */
  const [leading, setLeading] = useState<CardListItem | null>(null);
  /** Stage timings for physical-device performance checks, dev builds only. */
  const [scanDebug, setScanDebug] = useState('');

  // Called back on the JS thread once a frame has been read.
  const handleResult = useCallback(
    (matches: ArtMatch[], detected: boolean, stageMs: number[]) => {
      if (!enabledRef.current) return;
      lastError.current = null;
      setScanError(false);
      setCardDetected(detected);
      noteCard(detected);
      const next = identify(matches);
      // Same card, new object: swapping it would re-render the overlay every frame.
      setLeading((current) =>
        current?.variantNumber === next?.variantNumber ? current : next
      );
      if (__DEV__) {
        const score = matches[0] ? matches[0].score.toFixed(2) : '–';
        setScanDebug(`${stageMs.join('+')}ms · ${score}`);
      }
      const outcome = resolve(matches);
      if (outcome) present(outcome);
    },
    [enabledRef, identify, noteCard, present, resolve]
  );

  const options = useMemo(() => {
    const guide = toVisionRegion(cardRect());
    return {
      regionX: guide.x,
      regionY: guide.y,
      regionWidth: guide.width,
      regionHeight: guide.height,
    } satisfies Omit<FrameScanOptions, 'orientation'>;
  }, []);

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
        if (!scanning.value) return;
        const result = cardOcrFrame.pollScan(frame, {
          ...options,
          ...previewRegionToFrameRegion(options, frame),
          orientation: frame.orientation,
        });
        if (!result) return;
        scheduleOnRN(
          handleResult,
          result.matches,
          result.cardDetected,
          [result.locateMs, result.describeMs, result.searchMs].map(Math.round)
        );
      } catch (error) {
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

  return { frameOutput, cardDetected, leading, scanDebug, scanError };
}
