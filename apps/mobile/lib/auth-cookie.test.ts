import { beforeEach, describe, expect, mock, test } from 'bun:test';

const platform = { OS: 'ios' };
const getCookie = mock(async () => 'better-auth.session_token=client-session');
const getItem = mock(() => null as string | null);
const formatStoredCookie = mock((stored: string) => `formatted:${stored}`);

mock.module('react-native', () => ({ Platform: platform }));
mock.module('@better-auth/expo/client', () => ({
  getCookie: formatStoredCookie,
}));
mock.module('@/src/lib/auth-client', () => ({ authClient: { getCookie } }));
mock.module('@/src/lib/secure-storage', () => ({ secureStorage: { getItem } }));

const { getAuthCookieHeader } = await import('./auth-cookie');

beforeEach(() => {
  platform.OS = 'ios';
  getCookie.mockClear();
  getCookie.mockImplementation(async () => 'better-auth.session_token=client-session');
  getItem.mockClear();
  getItem.mockImplementation(() => null);
  formatStoredCookie.mockClear();
});

describe('getAuthCookieHeader', () => {
  test('resolves the asynchronous Expo client cookie on native', async () => {
    expect(await getAuthCookieHeader()).toBe(
      'better-auth.session_token=client-session'
    );
    expect(getItem).not.toHaveBeenCalled();
  });

  test('falls back to stored cookies when the client has no cookie', async () => {
    getCookie.mockImplementation(async () => '');
    getItem.mockImplementation(() => 'stored-session');
    expect(await getAuthCookieHeader()).toBe('formatted:stored-session');
    expect(getItem).toHaveBeenCalledWith('astral-grove_cookie');
  });

  test('returns an empty header when native has no stored session', async () => {
    getCookie.mockImplementation(async () => '');
    expect(await getAuthCookieHeader()).toBe('');
  });

  test('uses browser cookies on web without reading native storage', async () => {
    platform.OS = 'web';
    expect(await getAuthCookieHeader()).toBe('');
    expect(getCookie).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });
});
