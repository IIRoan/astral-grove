import { describe, expect, mock, test } from 'bun:test';
import { getSessionUser, unauthorized } from '../../src/lib/session.js';
import type { Auth } from '../../src/auth.js';

describe('getSessionUser', () => {
  test('returns the authenticated user when a session exists', async () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const auth = {
      api: {
        getSession: mock(async () => ({ user })),
      },
    } as unknown as Auth;

    const result = await getSessionUser(auth, new Headers());
    expect(result).toEqual(user);
  });

  test('returns null when no session is present', async () => {
    const auth = {
      api: {
        getSession: mock(async () => null),
      },
    } as unknown as Auth;

    expect(await getSessionUser(auth, new Headers())).toBeNull();
  });
});

describe('unauthorized', () => {
  test('returns the API unauthorized payload', () => {
    expect(unauthorized()).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Sign in required',
    });
  });
});
