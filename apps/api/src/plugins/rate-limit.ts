import { Elysia } from 'elysia';
import type { Env } from '../env.js';
import { clientIpFromHeaders, createSlidingWindowLimiter } from '../lib/rate-limit.js';

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 180;

/** Health, CORS, and cached card art; CDN origin misses are limited in ImageStoreService. */
export function isRateLimitExemptPath(pathname: string, method: string): boolean {
  if (method === 'OPTIONS') return true;
  if (pathname === '/api/v1/health') return true;
  if (pathname.startsWith('/api/v1/images/')) return true;
  return false;
}

export function createRateLimitPlugin(env: Env) {
  const enabled = env.NODE_ENV === 'production';
  const general = createSlidingWindowLimiter({ windowMs: WINDOW_MS, max: DEFAULT_MAX });

  return new Elysia({ name: 'rate-limit' }).beforeHandle(({ request, set }) => {
    if (!enabled) return;

    const path = new URL(request.url).pathname;
    if (isRateLimitExemptPath(path, request.method)) return;

    const ip = clientIpFromHeaders(request.headers);
    const decision = general.check(`${ip}:api`);
    if (decision.allowed) return;

    set.status = 429;
    set.headers['retry-after'] = String(decision.retryAfterSec);
    return { error: 'RATE_LIMITED', message: 'Too many requests' };
  });
}
