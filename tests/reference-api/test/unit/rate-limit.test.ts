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
  test('uses Railway X-Real-IP and ignores spoofable X-Forwarded-For', () => {
    const headers = new Headers({
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.1, 203.0.113.9',
    });
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.9');
  });

  test('does not trust X-Forwarded-For when X-Real-IP is absent', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.1',
    });
    expect(clientIpFromHeaders(headers)).toBe('unknown');
  });

  test('rejects multi-value or non-IP X-Real-IP', () => {
    expect(
      clientIpFromHeaders(new Headers({ 'x-real-ip': '203.0.113.9, 198.51.100.1' }))
    ).toBe('unknown');
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': 'evil.example' }))).toBe(
      'unknown'
    );
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
