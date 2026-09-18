import { useCallback, useMemo, useRef } from 'react';
import type { CameraView } from 'expo-camera';
import { ImageManipulator } from 'expo-image-manipulator';
import type { OcrLine } from '@riftbound/contracts';
import { recognizeCardText, type RecognizeOptions } from '@/modules/card-ocr';
import { cardRect, codeBandRect, previewRectToPhotoCrop } from '@/utils/scanCrop';
import type { ScanSession } from '@/hooks/useScanSession';
import type { ScannerRecognitionLevel } from '@/hooks/useScannerEngine';

/** Breather between passes. Short, because a human confirms every hit. */
const PASS_GAP_MS = 150;
/** The card pass only reads the name — large text, so it needs less resolution. */
const CARD_TARGET_WIDTH = 1200;
/** The code band is a thin strip of ~12px print, so it gets enlarged hard. */
const BAND_TARGET_WIDTH = 1600;

/**
 * Photo engine: expo-camera takes a still every ~150ms and Vision reads it.
 *
 * Simple and dependency-light, but every capture briefly interrupts the preview, which
 * is what makes this engine feel less smooth than the frame engine.
 */
export function useCardScannerPhoto(
  session: ScanSession,
  level: ScannerRecognitionLevel
) {
  const busy = useRef(false);

  const { codeOcr, nameOcr } = useMemo<{
    codeOcr: RecognizeOptions;
    nameOcr: RecognizeOptions;
  }>(
    () => ({
      codeOcr: {
        recognitionLevel: level,
        usesLanguageCorrection: false,
        maxCandidates: 3,
      },
      nameOcr: {
        recognitionLevel: level,
        usesLanguageCorrection: false,
        maxCandidates: 2,
      },
    }),
    [level]
  );

  const runPass = useCallback(
    async (camera: CameraView | null) => {
      if (!camera || busy.current || !session.ready) return;
      busy.current = true;

      try {
        const picture = await camera.takePictureAsync({
          pictureRef: true,
          shutterSound: false,
        });
        if (!picture) return;

        // The bitmap stays native the whole way: capture → crop → recognize, with no
        // JPEG encode, file write, file read or decode in between.
        const readCrop = async (
          rect: ReturnType<typeof previewRectToPhotoCrop>,
          targetWidth: number,
          options: RecognizeOptions
        ): Promise<OcrLine[]> => {
          const context = ImageManipulator.manipulate(picture);
          context.crop(rect).resize({ width: targetWidth });
          const rendered = await context.renderAsync();
          return recognizeCardText(rendered, options);
        };

        // The collector code decides which printing this is, so the enlarged band is
        // read first and on its own. Only if it is illegible do we fall back to the
        // card as a whole for the name.
        const bandLines = await readCrop(
          previewRectToPhotoCrop(codeBandRect(), picture),
          BAND_TARGET_WIDTH,
          codeOcr
        );
        const fromCode = session.resolve(bandLines);
        if (fromCode?.kind === 'card') {
          session.present(fromCode);
          return;
        }

        const cardLines = await readCrop(
          previewRectToPhotoCrop(cardRect(), picture),
          CARD_TARGET_WIDTH,
          nameOcr
        );
        const fromCard = session.resolve(cardLines);
        const outcome = fromCard ?? fromCode;
        if (outcome) session.present(outcome);
      } catch {
        // A dropped frame is not worth surfacing — the next pass is milliseconds away.
      } finally {
        busy.current = false;
      }
    },
    [codeOcr, nameOcr, session]
  );

  return { runPass, passGapMs: PASS_GAP_MS };
}
