import type { CardOcrFrame } from '@/modules/card-ocr-frame/src/CardOcrFrame.nitro';

// VisionCamera iOS validates support even when the supplied value is false.
export function scannerLowLightProps(supported: boolean): {
  enableLowLightBoost?: true;
} {
  return supported ? { enableLowLightBoost: true } : {};
}

export function supportsNativeScanQueue(
  module: Partial<Pick<CardOcrFrame, 'pollScan' | 'resetScan' | 'setArtIndex'>>
): boolean {
  return (
    typeof module.pollScan === 'function' &&
    typeof module.resetScan === 'function' &&
    typeof module.setArtIndex === 'function'
  );
}
