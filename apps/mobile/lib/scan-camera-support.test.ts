import { describe, expect, test } from 'bun:test';
import {
  LOW_LIGHT_OFF,
  LOW_LIGHT_ON,
  nextLowLight,
  nextTorchSetting,
  scannerLowLightProps,
  supportsNativeScanQueue,
  torchOn,
} from './scan-camera-support';

describe('scanner camera configuration', () => {
  test('omits low-light configuration entirely on unsupported devices', () => {
    expect('enableLowLightBoost' in scannerLowLightProps(false)).toBe(false);
    expect(scannerLowLightProps(true)).toEqual({ enableLowLightBoost: true });
  });

  test('an older binary uses photo OCR instead of calling a missing native function', () => {
    expect(supportsNativeScanQueue({})).toBe(false);
    expect(supportsNativeScanQueue({ resetScan: () => {} })).toBe(false);
    expect(supportsNativeScanQueue({ pollScan: () => undefined })).toBe(false);
  });

  test('enables the native queue only when both native methods are available', () => {
    expect(
      supportsNativeScanQueue({ pollScan: () => undefined, resetScan: () => {} })
    ).toBe(true);
  });

  test('low light latches on below the dark threshold and off only well above it', () => {
    expect(nextLowLight(false, LOW_LIGHT_ON - 0.1)).toBe(true);
    expect(nextLowLight(false, LOW_LIGHT_ON)).toBe(false);
    // The torch itself brightens the reading; that must not switch it straight off.
    expect(nextLowLight(true, (LOW_LIGHT_ON + LOW_LIGHT_OFF) / 2)).toBe(true);
    expect(nextLowLight(true, LOW_LIGHT_OFF)).toBe(false);
    // A frame without metadata (or an older binary) changes nothing.
    expect(nextLowLight(true, undefined)).toBe(true);
    expect(nextLowLight(false, Number.NaN)).toBe(false);
  });

  test('the light follows the scene only in auto', () => {
    expect(torchOn('auto', true)).toBe(true);
    expect(torchOn('auto', false)).toBe(false);
    expect(torchOn('on', false)).toBe(true);
    expect(torchOn('off', true)).toBe(false);
    expect(nextTorchSetting('auto')).toBe('on');
    expect(nextTorchSetting('on')).toBe('off');
    expect(nextTorchSetting('off')).toBe('auto');
  });
});
