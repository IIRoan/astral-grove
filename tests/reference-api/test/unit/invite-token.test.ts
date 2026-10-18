import { describe, expect, test } from 'bun:test';
import {
  createInviteToken,
  hashInviteToken,
  inviteLookupKeys,
} from '../../src/lib/invite-token.js';

describe('invite tokens', () => {
  test('createInviteToken returns 64 hex chars', () => {
    expect(createInviteToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  test('hashInviteToken is stable and prefixed', () => {
    const token = 'a'.repeat(64);
    const hashed = hashInviteToken(token);
    expect(hashed.startsWith('sha256:')).toBe(true);
    expect(hashInviteToken(token)).toBe(hashed);
    expect(hashInviteToken('b'.repeat(64))).not.toBe(hashed);
  });

  test('inviteLookupKeys includes hash and plaintext for migration', () => {
    const token = createInviteToken();
    const keys = inviteLookupKeys(token);
    expect(keys).toEqual([hashInviteToken(token), token]);
  });
});
