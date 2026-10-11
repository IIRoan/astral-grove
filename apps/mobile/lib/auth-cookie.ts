import { getCookie as formatStoredAuthCookie } from '@better-auth/expo/client';
import { Platform } from 'react-native';
import { authClient } from '@/src/lib/auth-client';
import { secureStorage } from '@/src/lib/secure-storage';

const AUTH_COOKIE_STORAGE_KEY = 'astral-grove_cookie';

/** Native auth Cookie header; web should use `credentials: 'include'` instead. */
export async function getAuthCookieHeader(): Promise<string> {
  if (Platform.OS === 'web') return '';

  const clientGetCookie = (authClient as { getCookie?: () => Promise<string> })
    .getCookie;
  if (typeof clientGetCookie === 'function') {
    const cookie = await clientGetCookie.call(authClient);
    if (cookie) return cookie;
  }

  const stored = secureStorage.getItem(AUTH_COOKIE_STORAGE_KEY);
  return stored ? formatStoredAuthCookie(stored) : '';
}
