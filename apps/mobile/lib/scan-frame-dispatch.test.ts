import { describe, expect, mock, test } from 'bun:test';
import { dispatchScanFrame, scannerLowLightProps } from './scan-frame-dispatch';

describe('scanner camera configuration', () => {
  test('omits low-light configuration entirely on unsupported devices', () => {
    expect('enableLowLightBoost' in scannerLowLightProps(false)).toBe(false);
    expect(scannerLowLightProps(true)).toEqual({ enableLowLightBoost: true });
  });
});

describe('async scan frame ownership', () => {
  test('returns to the camera before recognition and releases the frame when done', () => {
    const frame = { dispose: mock(() => {}) };
    const scan = mock(() => {});
    const onError = mock(() => {});
    let worker: (() => void) | undefined;
    dispatchScanFrame(
      frame,
      {
        runAsync: (task) => {
          worker = task;
          return true;
        },
      },
      scan,
      onError
    );
    expect(scan).not.toHaveBeenCalled();
    expect(frame.dispose).not.toHaveBeenCalled();
    worker!();
    expect(scan).toHaveBeenCalledWith(frame);
    expect(frame.dispose).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  test('drops a frame immediately when the worker is busy', () => {
    const frame = { dispose: mock(() => {}) };
    const scan = mock(() => {});
    dispatchScanFrame(frame, { runAsync: () => false }, scan, () => {});
    expect(scan).not.toHaveBeenCalled();
    expect(frame.dispose).toHaveBeenCalledTimes(1);
  });

  test('a Vision failure releases the frame and returns normally to unlock the runner', () => {
    const frame = { dispose: mock(() => {}) };
    const error = new Error('Vision failed');
    const onError = mock(() => {});
    const runner = {
      runAsync: (task: () => void) => {
        task();
        return true;
      },
    };
    expect(() =>
      dispatchScanFrame(
        frame,
        runner,
        () => {
          throw error;
        },
        onError
      )
    ).not.toThrow();
    expect(frame.dispose).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  test('a scheduling failure also releases the frame', () => {
    const frame = { dispose: mock(() => {}) };
    const error = new Error('Worker unavailable');
    const onError = mock(() => {});
    dispatchScanFrame(
      frame,
      {
        runAsync: () => {
          throw error;
        },
      },
      () => {},
      onError
    );
    expect(frame.dispose).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });
});
