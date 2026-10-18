import { describe, expect, test } from 'bun:test';
import { headersWithBearerSession } from '../../src/lib/bearer-session.js';

describe('headersWithBearerSession', () => {
  test('maps bearer token to better-auth session cookie', () => {
    const headers = new Headers({
      authorization: 'Bearer signed.session.token',
    });
    const resolved = headersWithBearerSession(headers);
    expect(resolved.get('cookie')).toBe(
      '__Secure-better-auth.session_token=signed.session.token'
    );
  });

  test('leaves headers unchanged without bearer auth', () => {
    const headers = new Headers({ accept: 'application/json' });
    expect(headersWithBearerSession(headers)).toBe(headers);
  });
});
