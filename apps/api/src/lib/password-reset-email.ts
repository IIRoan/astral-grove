import type { Env } from '../env.js';

export type ResetPasswordEmailInput = {
  email: string;
  token: string;
  appUrl: string;
  callbackUrl: string;
};

export function buildPasswordResetLink(input: {
  appUrl: string;
  token: string;
  email: string;
}): string {
  const base = input.appUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    token: input.token.trim(),
    email: input.email.trim().toLowerCase(),
  });
  return `${base}/reset-password?${params.toString()}`;
}

export function buildPasswordResetDeepLink(input: {
  token: string;
  email: string;
}): string {
  const params = new URLSearchParams({
    token: input.token.trim(),
    email: input.email.trim().toLowerCase(),
  });
  return `astral-grove://reset-password?${params.toString()}`;
}

export function resetPasswordEmailContent(input: ResetPasswordEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const link = buildPasswordResetLink({
    appUrl: input.appUrl,
    token: input.token,
    email: input.email,
  });
  const deepLink = buildPasswordResetDeepLink({
    token: input.token,
    email: input.email,
  });

  return {
    subject: 'Reset your Astral Grove password',
    text: [
      'Choose a new password for The Astral Grove.',
      '',
      `Open this link: ${link}`,
      '',
      `On a phone with the app installed: ${deepLink}`,
      '',
      'If the links above do not work, use this fallback:',
      input.callbackUrl,
      '',
      'If you did not ask for this, you can ignore the email.',
      '',
    ].join('\n'),
    html: [
      '<p>Choose a new password for The Astral Grove.</p>',
      `<p><a href="${link}">Choose a new password</a></p>`,
      `<p style="color:#666;font-size:0.9em">Prefer the app? <a href="${deepLink}">Open in The Astral Grove</a></p>`,
      `<p style="color:#666;font-size:0.85em"><a href="${input.callbackUrl}">Fallback reset link</a></p>`,
      '<p style="color:#666;font-size:0.9em">If you did not ask for this, you can ignore the email.</p>',
    ].join(''),
  };
}

export function resolvePasswordResetAppUrl(env: Env): string {
  return env.PUBLIC_APP_URL;
}
