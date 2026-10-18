import type { Auth } from '../auth.js';
import { headersWithBearerSession } from './bearer-session.js';

type AuthUser = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>['user'];

export async function getSessionUser(
  auth: Auth,
  headers: Headers
): Promise<AuthUser | null> {
  const session = await auth.api.getSession({
    headers: headersWithBearerSession(headers),
  });
  return session?.user ?? null;
}

export function unauthorized() {
  return { error: 'UNAUTHORIZED' as const, message: 'Sign in required' };
}
