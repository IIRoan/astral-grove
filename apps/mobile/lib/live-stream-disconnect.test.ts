import { describe, expect, test } from 'bun:test';
import { isLiveStreamDisconnect } from '@/lib/live-stream-disconnect';

describe('isLiveStreamDisconnect', () => {
  test('treats Firefox stream drops as reconnectable', () => {
    const error = new TypeError('Error in input stream');
    expect(isLiveStreamDisconnect(error)).toBe(true);
  });

  test('treats Chrome and abort stream drops as reconnectable', () => {
    expect(isLiveStreamDisconnect(new TypeError('network error'))).toBe(true);
    expect(isLiveStreamDisconnect(new TypeError('Failed to fetch'))).toBe(true);
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(isLiveStreamDisconnect(abort)).toBe(true);
  });

  test('leaves application errors as failures', () => {
    expect(isLiveStreamDisconnect(new Error('collection.live 401: unauthorized'))).toBe(
      false
    );
    expect(
      isLiveStreamDisconnect(new TypeError('Cannot read properties of null'))
    ).toBe(false);
  });
});
