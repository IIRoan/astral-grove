import { describe, expect, test } from 'bun:test';
import {
  buildEmailVerificationDeepLink,
  buildEmailVerificationLink,
  changeEmailOtpEmailContent,
  verificationEmailContent,
} from '../../src/lib/verification-email.js';

describe('verification email content', () => {
  test('builds https and native verify links with email + otp', () => {
    expect(
      buildEmailVerificationLink({
        appUrl: 'https://rift.solace.onl/',
        email: 'User@Example.com',
        otp: '123456',
      })
    ).toBe('https://rift.solace.onl/verify-email?email=user%40example.com&otp=123456');

    expect(
      buildEmailVerificationDeepLink({
        email: 'User@Example.com',
        otp: '123456',
      })
    ).toBe('astral-grove://verify-email?email=user%40example.com&otp=123456');
  });

  test('includes both the code and the unique link in the message', () => {
    const content = verificationEmailContent({
      email: 'user@example.com',
      otp: '654321',
      appUrl: 'https://rift.solace.onl',
    });
    expect(content.subject).toContain('Verify');
    expect(content.text).toContain('654321');
    expect(content.text).toContain(
      'https://rift.solace.onl/verify-email?email=user%40example.com&otp=654321'
    );
    expect(content.html).toContain('654321');
    expect(content.html).toContain('Verify email with this link');
  });
});

describe('change-email OTP email content', () => {
  test('directs the code into Settings credentials, not verify-email links', () => {
    const content = changeEmailOtpEmailContent({
      email: 'new@example.com',
      otp: '112233',
      currentEmail: 'Old@Example.com',
    });
    expect(content.subject).toContain('Verify your new Astral Grove email');
    expect(content.text).toContain('112233');
    expect(content.text).toContain('old@example.com');
    expect(content.text).toContain('Settings → Credentials');
    expect(content.text).toContain('verified when the change completes');
    expect(content.text).not.toContain('/verify-email');
    expect(content.html).toContain('112233');
    expect(content.html).toContain('Settings → Credentials');
  });
});
