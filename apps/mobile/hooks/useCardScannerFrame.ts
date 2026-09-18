import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import { useLatestRef } from '@/hooks/useLatestRef';
import { scheduleOnRN } from 'react-native-worklets';
import {
  cardOcrFrame,
  type FrameScanOptions,
  type ImageMatch,
} from '@/modules/card-ocr-frame/src';
import {
  cardRect,
  codeBandRect,
  toVisionRegion,
  previewRegionToFrameRegion,
} from '@/utils/scanCrop';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';

/** Allow exposure to settle between passes; recognition runs on a separate worker. */
const SCAN_IDLE_MS = 80;

/**
 * Width the located card is straightened to. The collector code is roughly 1.5% of the
 * card's height, so at 1000px wide it lands around 20px tall — comfortably inside what
 * Vision reads reliably, without paying for a needlessly large pass.
 */
const RECTIFIED_WIDTH = 1000;

/** `0.91 Δ0.12 OGN-007` — best score, its lead over the runner-up, and what it matched. */
function describeMatches(matches: ImageMatch[]): string {
  const [best, next] = matches;
  if (!best) return '';
  const lead = best.score - (next?.score ?? 0);
  const label =
    best.key
      .split('/')
      .pop()
      ?.replace(/\.\w+$/, '') ?? '';
  return `${best.score.toFixed(2)} Δ${lead.toFixed(2)} ${label}`;
}

/**
 * Frame engine: Apple Vision locates, straightens, reads and recognizes the card, all
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
  /** Set when a quick strip-only read settled nothing, so the next pass reads it all. */
  const wantWholeCard = useSharedValue(false);
  const [cardDetected, setCardDetected] = useState(false);
  /**
   * Live artwork scores and stage timings (locate + match + read), dev builds only:
   * what `IMAGE_MATCH_FLOOR` and the pass budget are tuned against.
   */
  const [artDebug, setArtDebug] = useState('');

  // Called back on the JS thread once a frame has been read.
  const handleResult = useCallback(
    (
      lines: string[][],
      detected: boolean,
      matches: ImageMatch[],
      wholeCard: boolean,
      stageMs: number[]
    ) => {
      if (!enabledRef.current) return;
      lastError.current = null;
      setScanError(false);
      setCardDetected(detected);
      noteCard(detected);
      if (__DEV__) {
        const timing = stageMs.length > 0 ? `${stageMs.join('+')}ms` : '';
        setArtDebug([describeMatches(matches), timing].filter(Boolean).join(' '));
      }
      const outcome = resolve(lines, matches, wholeCard);
      wantWholeCard.value = !outcome;
      if (outcome) present(outcome);
    },
    [enabledRef, noteCard, present, resolve, wantWholeCard]
  );

  const { codeOptions, cardOptions } = useMemo(() => {
    // Read the code band when card detection misses.
    const band = toVisionRegion(codeBandRect());
    const card = toVisionRegion(cardRect());
    const base = {
      recognitionLevel: level,
      usesLanguageCorrection: false,
      rectifiedWidth: RECTIFIED_WIDTH,
    };
    return {
      codeOptions: {
        ...base,
        maxCandidates: 3,
        regionX: band.x,
        regionY: band.y,
        regionWidth: band.width,
        regionHeight: band.height,
      } satisfies Omit<FrameScanOptions, 'orientation' | 'wholeCard'>,
      cardOptions: {
        ...base,
        // The name is large; two readings are plenty and it keeps the pass cheap.
        maxCandidates: 2,
        regionX: card.x,
        regionY: card.y,
        regionWidth: card.width,
        regionHeight: card.height,
      } satisfies Omit<FrameScanOptions, 'orientation' | 'wholeCard'>,
    };
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
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      try {
        if (!scanning.value || performance.now() - lastScanEnd.value < SCAN_IDLE_MS)
          return;
        const options = wantWholeCard.value ? cardOptions : codeOptions;
        const result = cardOcrFrame.pollScan(frame, {
          ...options,
          ...previewRegionToFrameRegion(options, frame),
          orientation: frame.orientation,
          wholeCard: wantWholeCard.value,
        });
        if (!result) return;
        lastScanEnd.value = performance.now();
        scheduleOnRN(
          handleResult,
          result.lines,
          result.cardDetected,
          result.matches,
          result.wholeCard,
          [result.locateMs, result.matchMs, result.readMs].map(Math.round)
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

  return { frameOutput, cardDetected, artDebug, scanError };
}
