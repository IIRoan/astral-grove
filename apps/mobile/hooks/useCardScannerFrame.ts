import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import { useLatestRef } from '@/hooks/useLatestRef';
import { scheduleOnRN } from 'react-native-worklets';
import {
  cardOcrFrame,
  type FrameScanOptions,
  type FrameScanResult,
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

/**
 * Breathing room between recognition passes, from the end of one to the start of the
 * next.
 *
 * `dropFramesWhileBusy` stops two passes overlapping, but on its own the next frame
 * starts a pass the instant the previous one ends, so the pipeline never gets a moment
 * of slack and the camera reports `frame-was-late`. Measured from the end because a
 * pass that only reads the collector strip is several times quicker than a whole-card
 * one, and a fixed start-to-start interval would spend that saving idling.
 */
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
 * on the camera's own pixel buffer. No photo is captured, so the preview never stutters.
 */
export function useCardScannerFrame(
  session: ScanSession,
  level: ScannerRecognitionLevel,
  enabled: boolean
) {
  const { resolve, present, noteCard } = session;
  const enabledRef = useLatestRef(enabled);
  const scanning = useSharedValue(enabled);
  useEffect(() => {
    scanning.value = enabled;
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

  const frameOutput = useFrameOutput({
    // Vision is slower than the preview frame rate; without this the pipeline would queue frames
    // and stall the camera rather than simply skipping the ones it cannot keep up with.
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      let scanned = false;
      try {
        // Frames we skip are disposed immediately and cost the pipeline nothing, so
        // the preview keeps running at full rate while Vision works at its own pace.
        if (!scanning.value || performance.now() - lastScanEnd.value < SCAN_IDLE_MS)
          return;
        scanned = true;

        const orientation = frame.orientation;
        const options = wantWholeCard.value ? cardOptions : codeOptions;
        // Older builds resolve to `string[][]`; the current spec says `FrameScanResult`.
        const result = cardOcrFrame.scan(frame, {
          ...options,
          ...previewRegionToFrameRegion(options, frame),
          orientation,
          wholeCard: wantWholeCard.value,
        }) as unknown as FrameScanResult | string[][];

        // A build from before card detection returns the lines as a bare array. Keep
        // working against it so the native change can be picked up whenever it suits,
        // rather than the app breaking until it is rebuilt.
        if (Array.isArray(result)) {
          if (result.length > 0) {
            scheduleOnRN(handleResult, result, false, [], true, []);
            return;
          }
          // No detection to lean on, so fall back to reading the card as a whole and
          // letting the name narrow it down.
          const cardLines = cardOcrFrame.scan(frame, {
            ...cardOptions,
            ...previewRegionToFrameRegion(cardOptions, frame),
            orientation,
            wholeCard: true,
          }) as unknown as FrameScanResult | string[][];
          if (Array.isArray(cardLines) && cardLines.length > 0) {
            scheduleOnRN(handleResult, cardLines, false, [], true, []);
          }
          return;
        }

        // Card detection build: one call locates the card, straightens it, recognizes
        // the artwork and reads the collector strip — or the whole card when asked.
        const lines = result?.lines ?? [];
        const detected = result?.cardDetected ?? false;
        // Absent on a build from before artwork matching, and until the index is in.
        const matches = result?.matches ?? [];
        // Reported even when empty: a card being taken away is news too — it unlocks
        // the guide and lets the same card be scanned again.
        scheduleOnRN(
          handleResult,
          lines,
          detected,
          matches,
          // A build from before strip-first reading always read the whole card.
          result?.wholeCard ?? true,
          result?.readMs === undefined
            ? []
            : [result.locateMs, result.matchMs, result.readMs].map(Math.round)
        );
      } finally {
        // Only a real pass restarts the clock — a skipped frame doing so would mean
        // the gap never elapses and nothing is ever scanned.
        if (scanned) lastScanEnd.value = performance.now();
        // Must happen even on a throw or an early return, or the camera pipeline
        // stalls out of buffers.
        frame.dispose();
      }
    },
  });

  return { frameOutput, cardDetected, artDebug };
}
