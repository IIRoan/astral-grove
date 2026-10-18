const BEARER_SCHEME = 'bearer ';
const SESSION_COOKIE = '__Secure-better-auth.session_token';

/** Map Authorization Bearer → session cookie Better Auth expects in getSession(). */
export function headersWithBearerSession(headers: Headers): Headers {
  const authorization = headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith(BEARER_SCHEME)) {
    return headers;
  }

  const token = authorization.slice(BEARER_SCHEME.length).trim();
  if (!token) return headers;

  const resolved = new Headers(headers);
  const existing = resolved.get('cookie');
  const sessionPair = `${SESSION_COOKIE}=${token}`;
  resolved.set('cookie', existing ? `${existing}; ${sessionPair}` : sessionPair);
  return resolved;
}
