import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { API_URL_RUNTIME_OVERRIDE_KEY } from '../../lib/api-url';
import { API_URL, WEB_ORIGIN } from './env';

export type UiE2eUser = {
  email: string;
  password: string;
  name: string;
};

export function uniqueTestUser(prefix = 'ui-e2e'): UiE2eUser {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `${prefix}-${stamp}@test.riftbound.dev`,
    password: 'Password1234',
    name: `UI E2E ${stamp}`,
  };
}

/** Init script: point Expo web at local API (Metro inlines .env; shell EXPO_PUBLIC_* cannot override). */
export async function installLocalApiOverride(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ key, apiUrl }) => {
      Object.defineProperty(globalThis, key, {
        value: apiUrl,
        configurable: true,
        enumerable: false,
        writable: true,
      });
    },
    { key: API_URL_RUNTIME_OVERRIDE_KEY, apiUrl: API_URL }
  );
}

/** Hydrate the cookie returned by Better Auth, including its local/HTTPS name and security attributes. */
export async function signUpAndHydrateSession(
  context: BrowserContext,
  user: UiE2eUser = uniqueTestUser()
): Promise<UiE2eUser> {
  const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      origin: WEB_ORIGIN,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
    }),
  });
  expect(res.ok, `sign-up HTTP ${res.status}: ${await res.text()}`).toBeTruthy();

  const sessionCookie = res.headers
    .getSetCookie()
    .find((cookie) =>
      cookie.slice(0, cookie.indexOf('=')).endsWith('better-auth.session_token')
    );
  expect(sessionCookie, 'missing session cookie from sign-up').toBeTruthy();
  const [pair, ...attributes] = sessionCookie!.split(';');
  const separator = pair!.indexOf('=');

  await context.addCookies([
    {
      name: pair!.slice(0, separator),
      value: pair!.slice(separator + 1),
      domain: new URL(API_URL).hostname,
      path: '/',
      httpOnly: true,
      secure: attributes.some(
        (attribute) => attribute.trim().toLowerCase() === 'secure'
      ),
      sameSite: 'Lax',
    },
  ]);

  return user;
}

/** Land on search as an authenticated user (AuthGate cleared). */
export async function gotoSignedInSearch(page: Page): Promise<void> {
  await page.goto('/search');
  await expect(
    page.getByPlaceholder('Search cards, artists, tags, or set numbers')
  ).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveCount(0);
}
