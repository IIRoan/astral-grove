import { describe, expect, test } from 'bun:test';
import {
  isCompleteVerificationOtp,
  parseVerificationSearchParams,
} from '@/lib/email-verification';

describe('email verification helpers', () => {
  test('accepts a 6-digit otp', () => {
    expect(isCompleteVerificationOtp('123456')).toBe(true);
    expect(isCompleteVerificationOtp('12 34 56')).toBe(true);
    expect(isCompleteVerificationOtp('12345')).toBe(false);
    expect(isCompleteVerificationOtp('abcdef')).toBe(false);
  });

  test('parses verify-email query params', () => {
    expect(
      parseVerificationSearchParams({
        email: 'User@Example.com',
        otp: '654321',
      })
    ).toEqual({ email: 'user@example.com', otp: '654321', token: '' });
    expect(parseVerificationSearchParams({ email: 'a@b.com' })).toBeNull();
  });

  test('parses emailed link tokens and rejects malformed ones', () => {
    const token = 'a'.repeat(42) + '_';
    expect(parseVerificationSearchParams({ email: 'a@b.com', token })).toEqual({
      email: 'a@b.com',
      otp: '',
      token,
    });
    expect(
      parseVerificationSearchParams({ email: 'a@b.com', token: 'short' })
    ).toBeNull();
    expect(
      parseVerificationSearchParams({ email: 'a@b.com', token: 'a'.repeat(42) + '/' })
    ).toBeNull();
  });
});
