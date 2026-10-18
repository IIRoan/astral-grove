import { createHash, randomBytes } from 'node:crypto';

const HASH_PREFIX = 'sha256:';

export function createInviteToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashInviteToken(token: string): string {
  return HASH_PREFIX + createHash('sha256').update(token).digest('hex');
}

export function inviteLookupKeys(token: string): string[] {
  const hashed = hashInviteToken(token);
  if (token.startsWith(HASH_PREFIX) || token === hashed) return [hashed];
  return [hashed, token];
}
