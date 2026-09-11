import { describe, expect, test } from 'bun:test';
import {
  apiListenOptions,
  BUN_IDLE_TIMEOUT_SECONDS,
  COLLECTION_LIVE_HEARTBEAT_MS,
} from '../../src/lib/http-listen.js';

describe('apiListenOptions', () => {
  test('raises Bun idleTimeout above the collection SSE heartbeat', () => {
    expect(BUN_IDLE_TIMEOUT_SECONDS).toBe(255);
    expect(COLLECTION_LIVE_HEARTBEAT_MS).toBeLessThan(BUN_IDLE_TIMEOUT_SECONDS * 1000);
    expect(apiListenOptions(7000)).toEqual({
      port: 7000,
      idleTimeout: 255,
    });
    expect(apiListenOptions(7000, '::')).toEqual({
      port: 7000,
      hostname: '::',
      idleTimeout: 255,
    });
  });
});
