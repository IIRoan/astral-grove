import { requireOptionalNativeModule } from 'expo';
// Same entry point expo-image-manipulator types its own image arguments from — the
// `SharedRef` exported from `expo` is the runtime class, not the instance type.
import type { SharedRef } from 'expo-modules-core/types';

/** One recognized line: Vision's ranked readings, best first, not just the top guess. */
export type OcrLineReadings = string[];

/**
 * Any shared image reference — a `PictureRef` from expo-camera or an `ImageRef` from
 * expo-image-manipulator. Passing the reference keeps the bitmap native-side instead of
 * round-tripping it through a JPEG on disk.
 */
export type SharedImageRef = SharedRef<'image'>;

export type RecognizeOptions = {
  recognitionLevel?: 'fast' | 'accurate';
  /** Leave false for collector codes — they are serial numbers, not words. */
  usesLanguageCorrection?: boolean;
  languages?: string[];
  /** Fraction of image height; 0 leaves Vision's default. Tune against a real device. */
  minimumTextHeight?: number;
  maxCandidates?: number;
};

type CardOcrNativeModule = {
  isSupported: boolean;
  recognize(
    image: SharedImageRef,
    options: RecognizeOptions
  ): Promise<OcrLineReadings[]>;
};

const CardOcr = requireOptionalNativeModule<CardOcrNativeModule>('CardOcr');

/** False on Android and web, where the module has no implementation. */
export const isCardOcrAvailable = CardOcr?.isSupported ?? false;

export async function recognizeCardText(
  image: SharedImageRef,
  options: RecognizeOptions = {}
): Promise<OcrLineReadings[]> {
  if (!CardOcr) return [];
  return CardOcr.recognize(image, options);
}
