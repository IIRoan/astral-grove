import type { AsyncRunner } from 'react-native-vision-camera';

// VisionCamera iOS validates support even when the supplied value is false.
export function scannerLowLightProps(supported: boolean): {
  enableLowLightBoost?: true;
} {
  return supported ? { enableLowLightBoost: true } : {};
}

/** Transfer a frame to one worker, or release it immediately if the worker is busy. */
export function dispatchScanFrame<T extends { dispose(): void }>(
  frame: T,
  runner: Pick<AsyncRunner, 'runAsync'>,
  scan: (frame: T) => void,
  onError: (error: unknown) => void
) {
  'worklet';
  try {
    const accepted = runner.runAsync(() => {
      'worklet';
      try {
        scan(frame);
      } catch (error) {
        // A thrown task leaves VisionCamera's runner busy; report it and return normally.
        onError(error);
      } finally {
        frame.dispose();
      }
    });
    if (!accepted) frame.dispose();
  } catch (error) {
    frame.dispose();
    onError(error);
  }
}
