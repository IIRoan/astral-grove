import { describe, expect, test } from 'bun:test';
import { scannerLowLightProps, supportsNativeScanQueue } from './scan-camera-support';

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
});
