import { createHash, timingSafeEqual } from 'node:crypto';
import type { Env } from '../env.js';

/** Constant-time compare via equal-length SHA-256 digests. */
export function tokensMatch(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export function readBearerToken(authorization: string | null | undefined): string {
  if (!authorization) return '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

export function isAdminAuthorization(
  env: Env,
  authorization: string | null | undefined
): boolean {
  const token = readBearerToken(authorization);
  if (!token) return false;
  return tokensMatch(token, env.ADMIN_SYNC_TOKEN);
}

export function assertAdmin(env: Env, authorization: string | null | undefined): void {
  if (!isAdminAuthorization(env, authorization)) {
    throw new Error('Unauthorized');
  }
}
