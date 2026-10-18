import { afterEach, describe, expect, mock, test } from 'bun:test';
import { logActionFailure } from '../../src/lib/logger.js';

describe('logActionFailure', () => {
  afterEach(() => {
    mock.restore();
  });

  test('writes structured JSON to stderr', () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy;

    logActionFailure('collection.import', new Error('boom'), { userId: 'u1' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0]?.[0]);
    const payload = JSON.parse(line) as {
      level: string;
      event: string;
      action: string;
      message: string;
      userId: string;
    };
    expect(payload.level).toBe('error');
    expect(payload.event).toBe('action.failed');
    expect(payload.action).toBe('collection.import');
    expect(payload.message).toBe('boom');
    expect(payload.userId).toBe('u1');
  });
});
