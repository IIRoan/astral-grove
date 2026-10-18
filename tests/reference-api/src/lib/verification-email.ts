import type { Env } from '../env.js';

export type VerificationEmailInput = {
  email: string;
  otp: string;
  appUrl: string;
};

export function buildEmailVerificationLink(input: {
  appUrl: string;
  email: string;
  otp: string;
}): string {
  const base = input.appUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    email: input.email.trim().toLowerCase(),
    otp: input.otp.trim(),
  });
  return `${base}/verify-email?${params.toString()}`;
}

export function buildEmailVerificationDeepLink(input: {
  email: string;
  otp: string;
}): string {
  const params = new URLSearchParams({
    email: input.email.trim().toLowerCase(),
    otp: input.otp.trim(),
  });
  return `astral-grove://verify-email?${params.toString()}`;
}

export function verificationEmailContent(input: VerificationEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const link = buildEmailVerificationLink({
    appUrl: input.appUrl,
    email: input.email,
    otp: input.otp,
  });
  const deepLink = buildEmailVerificationDeepLink({
    email: input.email,
    otp: input.otp,
  });

  return {
    subject: 'Verify your Astral Grove email',
    text: [
      'Confirm your email to finish setting up The Astral Grove.',
      '',
      `Verification code: ${input.otp}`,
      '',
      `Or open this link: ${link}`,
      '',
      `On a phone with the app installed: ${deepLink}`,
      '',
    ].join('\n'),
    html: [
      '<p>Confirm your email to finish setting up The Astral Grove.</p>',
      `<p>Your verification code is <strong style="font-size:1.25em;letter-spacing:0.08em">${input.otp}</strong></p>`,
      `<p><a href="${link}">Verify email with this link</a></p>`,
      `<p style="color:#666;font-size:0.9em">Prefer the app? <a href="${deepLink}">Open in The Astral Grove</a></p>`,
    ].join(''),
  };
}

export function resolveVerificationAppUrl(env: Env): string {
  return env.PUBLIC_APP_URL;
}

export type ChangeEmailOtpEmailInput = {
  email: string;
  otp: string;
  currentEmail?: string;
};

export function changeEmailOtpEmailContent(input: ChangeEmailOtpEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const current =
    typeof input.currentEmail === 'string' && input.currentEmail.trim().length > 0
      ? input.currentEmail.trim().toLowerCase()
      : null;

  return {
    subject: 'Verify your new Astral Grove email',
    text: [
      'Verify this address to make it your new sign-in email for The Astral Grove.',
      current ? `Current address on the account: ${current}` : null,
      '',
      `Verification code: ${input.otp}`,
      '',
      'Enter the code in Settings → Credentials. The address is verified when the change completes.',
      'If you did not ask for this, you can ignore the email.',
      '',
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
    html: [
      '<p>Verify this address to make it your new sign-in email for The Astral Grove.</p>',
      current
        ? `<p style="color:#666;font-size:0.9em">Current address on the account: ${current}</p>`
        : '',
      `<p>Your verification code is <strong style="font-size:1.25em;letter-spacing:0.08em">${input.otp}</strong></p>`,
      '<p>Enter the code in <strong>Settings → Credentials</strong>. The address is verified when the change completes.</p>',
      '<p style="color:#666;font-size:0.9em">If you did not ask for this, you can ignore the email.</p>',
    ]
      .filter((part) => part.length > 0)
      .join(''),
  };
}
