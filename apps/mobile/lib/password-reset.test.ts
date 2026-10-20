import { describe, expect, test } from 'bun:test';
import {
  parsePasswordResetSearchParams,
  resolvePasswordResetRedirectTo,
} from './password-reset';

describe('password reset helpers', () => {
  test('parses token, email, and error query params', () => {
    expect(parsePasswordResetSearchParams({ token: 'abc', email: 'A@B.com' })).toEqual({
      token: 'abc',
      email: 'a@b.com',
    });
    expect(parsePasswordResetSearchParams({ error: 'INVALID_TOKEN' })).toEqual({
      error: 'INVALID_TOKEN',
    });
    expect(parsePasswordResetSearchParams({})).toBeNull();
  });

  test('builds https redirect with email and rejects non-https origins', () => {
    expect(resolvePasswordResetRedirectTo('javascript:alert(1)')).toMatch(
      /^https?:\/\/[^/]+\/reset-password$/
    );
    expect(resolvePasswordResetRedirectTo('https://rift.solace.onl', 'a@b.com')).toBe(
      'https://rift.solace.onl/reset-password?email=a%40b.com'
    );
  });

  test('skips loopback web origin when EXPO_PUBLIC_APP_URL is set', () => {
    const prev = process.env.EXPO_PUBLIC_APP_URL;
    process.env.EXPO_PUBLIC_APP_URL = 'https://riftbounddev.roan.dev';
    try {
      expect(resolvePasswordResetRedirectTo('http://localhost:7001', 'a@b.com')).toBe(
        'https://riftbounddev.roan.dev/reset-password?email=a%40b.com'
      );
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_APP_URL;
      else process.env.EXPO_PUBLIC_APP_URL = prev;
    }
  });
});
