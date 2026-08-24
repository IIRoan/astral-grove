import { describe, expect, test } from 'bun:test';
import {
  clientIpFromHeaders,
  createSlidingWindowLimiter,
} from '../../src/lib/rate-limit.js';
import { isRateLimitExemptPath } from '../../src/plugins/rate-limit.js';

describe('createSlidingWindowLimiter', () => {
  test('allows up to max then rejects until the window resets', () => {
    let now = 1_000;
    const limiter = createSlidingWindowLimiter({
      windowMs: 1_000,
      max: 2,
      now: () => now,
    });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);
    const denied = limiter.check('ip');
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.retryAfterSec).toBeGreaterThan(0);

    now = 2_100;
    expect(limiter.check('ip').allowed).toBe(true);
  });
});

describe('clientIpFromHeaders', () => {
  test('prefers x-real-ip over x-forwarded-for', () => {
    const headers = new Headers({
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.1, 203.0.113.9',
    });
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.9');
  });
});

describe('isRateLimitExemptPath', () => {
  test('skips health, CORS preflight, and card image routes', () => {
    expect(isRateLimitExemptPath('/api/v1/health', 'GET')).toBe(true);
    expect(isRateLimitExemptPath('/api/v1/cards', 'OPTIONS')).toBe(true);
    expect(isRateLimitExemptPath('/api/v1/images/cards/foo.webp', 'GET')).toBe(true);
    expect(isRateLimitExemptPath('/api/v1/cards', 'GET')).toBe(false);
    expect(isRateLimitExemptPath('/api/auth/sign-in/email', 'POST')).toBe(false);
  });
});
