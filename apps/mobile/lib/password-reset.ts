import { resolveAppOrigin } from '@/lib/deck-share-url';
import { normalizeVerificationEmail } from '@/lib/email-verification';

function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function resolveResetOrigin(webOrigin?: string | null): string {
  const fromWeb = String(webOrigin ?? '')
    .trim()
    .replace(/\/$/, '');
  const fromEnv = String(process.env.EXPO_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  if (fromWeb && !isLoopbackOrigin(fromWeb)) {
    return fromWeb;
  }
  if (fromEnv) {
    return fromEnv;
  }
  if (fromWeb) {
    return fromWeb;
  }
  return resolveAppOrigin(null);
}

/** HTTPS page Better Auth redirects to after validating the reset token; include email for immediate sign-in. */
export function resolvePasswordResetRedirectTo(
  webOrigin?: string | null,
  email?: string
): string {
  const origin = resolveResetOrigin(webOrigin);
  const params = new URLSearchParams();
  if (email) {
    params.set('email', normalizeVerificationEmail(email));
  }
  const query = params.toString();
  return query.length > 0
    ? `${origin}/reset-password?${query}`
    : `${origin}/reset-password`;
}

export function buildPasswordResetDeepLink(input: {
  token: string;
  email?: string;
}): string {
  const params = new URLSearchParams({ token: input.token.trim() });
  if (input.email) {
    params.set('email', normalizeVerificationEmail(input.email));
  }
  return `astral-grove://reset-password?${params.toString()}`;
}

export function parsePasswordResetSearchParams(params: {
  token?: string | string[];
  email?: string | string[];
  error?: string | string[];
}): { token: string; email: string | null } | { error: string } | null {
  const errorRaw = Array.isArray(params.error) ? params.error[0] : params.error;
  if (typeof errorRaw === 'string' && errorRaw.trim().length > 0) {
    return { error: errorRaw.trim() };
  }
  const tokenRaw = Array.isArray(params.token) ? params.token[0] : params.token;
  if (typeof tokenRaw !== 'string' || tokenRaw.trim().length === 0) {
    return null;
  }
  const emailRaw = Array.isArray(params.email) ? params.email[0] : params.email;
  const email =
    typeof emailRaw === 'string' && emailRaw.trim().length > 0
      ? normalizeVerificationEmail(emailRaw)
      : null;
  return { token: tokenRaw.trim(), email };
}
