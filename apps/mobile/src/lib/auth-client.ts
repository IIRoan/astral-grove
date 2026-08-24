import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { fetchWithApiWake } from '@/lib/api-fetch';
import { getApiUrl } from '@/lib/api-url';
import { secureStorage } from './secure-storage';

const API_URL = getApiUrl();
const isWeb = Platform.OS === 'web';

function nativeAuthScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  if (typeof scheme === 'string' && scheme.length > 0) return scheme;
  if (Array.isArray(scheme) && typeof scheme[0] === 'string' && scheme[0].length > 0) {
    return scheme[0];
  }
  return 'astral-grove';
}

export const authClient = createAuthClient({
  baseURL: API_URL,
  // Avoid remounting login when password managers steal window focus.
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
  fetchOptions: {
    credentials: 'include',
    customFetchImpl: fetchWithApiWake,
  },
  plugins: [
    emailOTPClient(),
    ...(isWeb
      ? []
      : [
          expoClient({
            scheme: nativeAuthScheme(),
            storagePrefix: 'astral-grove',
            storage: secureStorage,
          }),
        ]),
  ],
});

export type AuthSession = typeof authClient.$Infer.Session;
