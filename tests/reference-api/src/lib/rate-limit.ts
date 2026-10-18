export type RateLimitDecision =
  { allowed: true } | { allowed: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

export function createSlidingWindowLimiter(options: {
  windowMs: number;
  max: number;
  now?: () => number;
}) {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;

  return {
    check(key: string): RateLimitDecision {
      const ts = now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= ts) {
        buckets.set(key, { count: 1, resetAt: ts + options.windowMs });
        return { allowed: true };
      }
      if (existing.count >= options.max) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - ts) / 1000)),
        };
      }
      existing.count += 1;
      return { allowed: true };
    },
    reset(): void {
      buckets.clear();
    },
  };
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function isSingleClientIp(value: string): boolean {
  if (!value || value.includes(',') || /\s/.test(value)) return false;
  if (IPV4.test(value)) return true;
  return value.includes(':') && !value.includes('/');
}

/** Railway overwrites X-Real-IP; X-Forwarded-For's left-most hop is client-controlled. */
export function clientIpFromHeaders(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp && isSingleClientIp(realIp)) return realIp;
  return 'unknown';
}
