import { useCallback, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import {
  cardOcrFrame,
  type FrameScanOptions,
  type FrameScanResult,
  type ImageMatch,
} from '@/modules/card-ocr-frame/src';
import { cardRect, codeBandRect, toVisionRegion } from '@/utils/scanCrop';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';

/**
 * Minimum gap between recognition passes.
 *
 * `dropFramesWhileBusy` stops two passes overlapping, but on its own the next frame
 * starts a pass the instant the previous one ends, so the pipeline never gets a moment
 * of slack and the camera reports `frame-was-late`.
 */
const SCAN_INTERVAL_MS = 220;

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
 * on the camera's own pixel buffer. No photo is captured, so the preview never stutters.
 */
export function useCardScannerFrame(
  session: ScanSession,
  level: ScannerRecognitionLevel
) {
  const { resolve, present } = session;
  // Shared value, not a ref: the worklet runs off the JS thread and needs state that
  // survives between frames on its own runtime.
  const lastScanAt = useSharedValue(0);
  const [cardDetected, setCardDetected] = useState(false);
  /** Live artwork scores, dev builds only: what `IMAGE_MATCH_FLOOR` is tuned against. */
  const [artDebug, setArtDebug] = useState('');

  // Called back on the JS thread once a frame has been read.
  const handleResult = useCallback(
    (lines: string[][], detected: boolean, matches: ImageMatch[]) => {
      setCardDetected(detected);
      if (__DEV__) setArtDebug(describeMatches(matches));
      const outcome = resolve(lines, matches);
      if (outcome) present(outcome);
    },
    [present, resolve]
  );

  const { codeOptions, cardOptions } = useMemo(() => {
    // The code band is the region to read when the card has not been located — either
    // because this build predates card detection, or because detection missed.
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
      } satisfies Omit<FrameScanOptions, 'orientation'>,
      cardOptions: {
        ...base,
        // The name is large; two readings are plenty and it keeps the pass cheap.
        maxCandidates: 2,
        regionX: card.x,
        regionY: card.y,
        regionWidth: card.width,
        regionHeight: card.height,
      } satisfies Omit<FrameScanOptions, 'orientation'>,
    };
  }, [level]);

  const frameOutput = useFrameOutput({
    // Vision is far slower than 60fps; without this the pipeline would queue frames
    // and stall the camera rather than simply skipping the ones it cannot keep up with.
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      try {
        // Frames we skip are disposed immediately and cost the pipeline nothing, so
        // the preview keeps running at full rate while Vision works at its own pace.
        const now = performance.now();
        if (now - lastScanAt.value < SCAN_INTERVAL_MS) return;
        lastScanAt.value = now;

        const orientation = frame.orientation;
        // Older builds resolve to `string[][]`; the current spec says `FrameScanResult`.
        const result = cardOcrFrame.scan(frame, {
          ...codeOptions,
          orientation,
        }) as unknown as FrameScanResult | string[][];

        // A build from before card detection returns the lines as a bare array. Keep
        // working against it so the native change can be picked up whenever it suits,
        // rather than the app breaking until it is rebuilt.
        if (Array.isArray(result)) {
          if (result.length > 0) {
            scheduleOnRN(handleResult, result, false, []);
            return;
          }
          // No detection to lean on, so fall back to reading the card as a whole and
          // letting the name narrow it down.
          const cardLines = cardOcrFrame.scan(frame, {
            ...cardOptions,
            orientation,
          }) as unknown as FrameScanResult | string[][];
          if (Array.isArray(cardLines) && cardLines.length > 0) {
            scheduleOnRN(handleResult, cardLines, false, []);
          }
          return;
        }

        // Card detection build: one call locates the card, straightens it and reads it,
        // so a single pass picks up the name, the collector code and the artwork.
        const lines = result?.lines ?? [];
        const detected = result?.cardDetected ?? false;
        // Absent on a build from before artwork matching, and until the index is in.
        const matches = result?.matches ?? [];
        if (lines.length > 0 || detected) {
          scheduleOnRN(handleResult, lines, detected, matches);
        }
      } finally {
        // Must happen even on a throw or an early return, or the camera pipeline
        // stalls out of buffers.
        frame.dispose();
      }
    },
  });

  return { frameOutput, cardDetected, artDebug };
}
