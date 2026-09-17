import { describe, expect, test } from 'bun:test';
import { scannerLowLightProps, supportsNativeScanQueue } from './scan-camera-support';

describe('scanner camera configuration', () => {
  test('omits low-light configuration entirely on unsupported devices', () => {
    expect('enableLowLightBoost' in scannerLowLightProps(false)).toBe(false);
    expect(scannerLowLightProps(true)).toEqual({ enableLowLightBoost: true });
  });

  test('an older binary is refused rather than calling a missing native function', () => {
    expect(supportsNativeScanQueue({})).toBe(false);
    expect(supportsNativeScanQueue({ resetScan: () => {} })).toBe(false);
    expect(supportsNativeScanQueue({ pollScan: () => undefined })).toBe(false);
    // Frame scanning without artwork matching: the pipeline before this feature.
    expect(
      supportsNativeScanQueue({ pollScan: () => undefined, resetScan: () => {} })
    ).toBe(false);
  });

  test('enables the native queue once every scanning method is available', () => {
    expect(
      supportsNativeScanQueue({
        pollScan: () => undefined,
        resetScan: () => {},
        setArtIndex: () => 0,
      })
    ).toBe(true);
  });
});
