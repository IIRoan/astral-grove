import { describe, expect, test } from 'bun:test';
import {
  buildPasswordResetDeepLink,
  buildPasswordResetLink,
  resetPasswordEmailContent,
} from '../../src/lib/password-reset-email.js';

describe('password reset email content', () => {
  test('builds https and native reset links with token and email', () => {
    expect(
      buildPasswordResetLink({
        appUrl: 'https://rift.solace.onl/',
        token: 'abc-token',
        email: 'User@Example.com',
      })
    ).toBe(
      'https://rift.solace.onl/reset-password?token=abc-token&email=user%40example.com'
    );

    expect(
      buildPasswordResetDeepLink({
        token: 'abc-token',
        email: 'User@Example.com',
      })
    ).toBe('astral-grove://reset-password?token=abc-token&email=user%40example.com');
  });

  test('includes app links and fallback callback in the message', () => {
    const content = resetPasswordEmailContent({
      email: 'user@example.com',
      token: 'tok123',
      appUrl: 'https://rift.solace.onl',
      callbackUrl: 'https://api.example/api/auth/reset-password/tok123?callbackURL=%2F',
    });
    expect(content.subject).toContain('Reset');
    expect(content.text).toContain(
      'https://rift.solace.onl/reset-password?token=tok123&email=user%40example.com'
    );
    expect(content.text).toContain(
      'astral-grove://reset-password?token=tok123&email=user%40example.com'
    );
    expect(content.html).toContain('Choose a new password');
  });
});
