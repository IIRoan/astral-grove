import { describe, expect, test } from 'bun:test';
import { isAdminAuthorization, tokensMatch } from '../../src/lib/admin-token.js';
import type { Env } from '../../src/env.js';

describe('tokensMatch', () => {
  test('accepts equal secrets and rejects mismatches', () => {
    expect(tokensMatch('sync-token-12345678', 'sync-token-12345678')).toBe(true);
    expect(tokensMatch('sync-token-12345678', 'sync-token-87654321')).toBe(false);
    expect(tokensMatch('', 'sync-token-12345678')).toBe(false);
  });
});

describe('isAdminAuthorization', () => {
  const env = { ADMIN_SYNC_TOKEN: 'sync-token-12345678' } as Env;

  test('accepts bearer token that matches ADMIN_SYNC_TOKEN', () => {
    expect(isAdminAuthorization(env, 'Bearer sync-token-12345678')).toBe(true);
  });

  test('rejects missing or wrong tokens', () => {
    expect(isAdminAuthorization(env, undefined)).toBe(false);
    expect(isAdminAuthorization(env, 'Bearer nope')).toBe(false);
  });
});
