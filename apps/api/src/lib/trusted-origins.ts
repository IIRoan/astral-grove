import type { Env } from '../env.js';

/** Expo Go + development-client scheme patterns for Metro, tunnels, and EAS Update. */
const EXPO_DEV_ORIGINS = [
  'exp://',
  'exp://**',
  'exp://192.168.*.*:*/**',
  'exp://10.*.*.*:*/**',
  'exp://172.*.*.*:*/**',
  'exp://*.exp.direct',
  'exp://*.exp.direct:*',
  'exp://*.exp.direct:*/**',
  'exp+astral-grove://',
  'exp+astral-grove://*',
  'astral-grove-dev://',
  'astral-grove-dev://*',
  'https://u.expo.dev',
  'https://*.u.expo.dev',
] as const;

export function resolveTrustedOrigins(env: Env): string[] {
  const baseOrigin = (() => {
    try {
      return new URL(env.BETTER_AUTH_URL).origin;
    } catch {
      return null;
    }
  })();

  const origins = new Set<string>([
    'astral-grove://',
    'astral-grove://*',
    ...env.TRUSTED_ORIGINS,
    ...(baseOrigin ? [baseOrigin] : []),
  ]);

  if (env.PUBLIC_APP_URL) {
    try {
      origins.add(new URL(env.PUBLIC_APP_URL).origin);
    } catch {
      // ignore malformed PUBLIC_APP_URL
    }
  }

  if (env.NODE_ENV !== 'production') {
    for (const origin of EXPO_DEV_ORIGINS) {
      origins.add(origin);
    }
    for (const origin of [
      'http://localhost:7000',
      'http://localhost:7001',
      // Playwright UI e2e Expo web port (force API to :7000 without fighting tunneled web on :7001).
      'http://localhost:7011',
    ]) {
      origins.add(origin);
    }
  }

  return [...origins];
}

export function resolveCorsOrigins(env: Env): true | string[] {
  if (env.NODE_ENV !== 'production') return true;

  const browserOrigins = resolveTrustedOrigins(env).filter(
    (origin) => origin.startsWith('http://') || origin.startsWith('https://')
  );

  return browserOrigins.length > 0 ? browserOrigins : true;
}
