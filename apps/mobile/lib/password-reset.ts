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
  const safeOrigin = (value: string | null | undefined) => {
    try {
      const url = new URL(value ?? '');
      return url.protocol === 'https:' ||
        (url.protocol === 'http:' && isLoopbackOrigin(url.origin))
        ? url.origin
        : '';
    } catch {
      return '';
    }
  };
  const fromWeb = safeOrigin(webOrigin);
  const fromEnv = safeOrigin(process.env.EXPO_PUBLIC_APP_URL);

  if (fromWeb && !isLoopbackOrigin(fromWeb)) {
    return fromWeb;
  }
  if (fromEnv) {
    return fromEnv;
  }
  if (fromWeb) {
    return fromWeb;
  }
  return safeOrigin(resolveAppOrigin(null)) || 'https://rift.solace.onl';
}

/** HTTPS page Better Auth redirects to after validating the reset token; include email to identify the reset request. */
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
