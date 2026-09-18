import type { CardOcrFrame } from '@/modules/card-ocr-frame/src/CardOcrFrame.nitro';

// VisionCamera iOS validates support even when the supplied value is false.
export function scannerLowLightProps(supported: boolean): {
  enableLowLightBoost?: true;
} {
  return supported ? { enableLowLightBoost: true } : {};
}

export function supportsNativeScanQueue(
  module: Partial<Pick<CardOcrFrame, 'pollScan' | 'resetScan'>>
): boolean {
  return (
    typeof module.pollScan === 'function' && typeof module.resetScan === 'function'
  );
}

/** `auto` lets the scene brightness decide; `on` and `off` are the user's call. */
export type TorchSetting = 'auto' | 'on' | 'off';

export function nextTorchSetting(setting: TorchSetting): TorchSetting {
  return setting === 'auto' ? 'on' : setting === 'on' ? 'off' : 'auto';
}

export function torchOn(setting: TorchSetting, lowLight: boolean): boolean {
  return setting === 'on' || (setting === 'auto' && lowLight);
}

/**
 * Scene brightness (EXIF BrightnessValue, APEX stops) below which the light comes on,
 * and above which it goes back off. Wide apart on purpose: the light itself raises the
 * reading by a few stops, and a torch that flickers is worse than one left on.
 */
// ponytail: thresholds from published readings (about 8 in daylight, 0.7 in a dark
// interior), not from this camera — tune on device.
export const LOW_LIGHT_ON = 0;
export const LOW_LIGHT_OFF = 4.5;

export function nextLowLight(
  previous: boolean,
  brightness: number | undefined
): boolean {
  if (brightness === undefined || Number.isNaN(brightness)) return previous;
  return brightness < (previous ? LOW_LIGHT_OFF : LOW_LIGHT_ON);
}
