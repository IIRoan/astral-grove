import { Elysia } from 'elysia';
import type { Env } from '../env.js';

export function createSecurityHeadersPlugin(env: Env) {
  return new Elysia({ name: 'security-headers' }).afterHandle(({ set }) => {
    set.headers['x-content-type-options'] = 'nosniff';
    set.headers['x-frame-options'] = 'DENY';
    set.headers['referrer-policy'] = 'no-referrer';
    set.headers['x-permitted-cross-domain-policies'] = 'none';
    if (env.NODE_ENV === 'production') {
      set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    }
  });
}
