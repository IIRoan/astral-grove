import { expect, test } from '@playwright/test';
import { installLocalApiOverride } from './helpers/auth';
import { API_URL } from './helpers/env';
import { prepareSignedIn } from './helpers/session';

test.describe('auth gate', () => {
  test('signed-out users see the sign-in wall', async ({ context, page }) => {
    await installLocalApiOverride(context);
    await page.goto('/search');
    await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByRole('tab', { name: 'Sign up' })).toBeVisible();
    await expect(
      page.getByPlaceholder('Search cards, artists, tags, or set numbers')
    ).toHaveCount(0);
  });

  test('each page load re-issues a 90-day session cookie', async ({
    context,
    page,
  }) => {
    await prepareSignedIn(context, page, '/search');
    const sessionCookie = async () =>
      (await context.cookies(API_URL)).find((cookie) =>
        cookie.name.endsWith('better-auth.session_token')
      )!;
    // Age the stored cookie as if API calls had renewed the session without refreshing it.
    await context.addCookies([
      { ...(await sessionCookie()), expires: Math.floor(Date.now() / 1000) + 86400 },
    ]);
    await page.reload();
    await expect(
      page.getByPlaceholder('Search cards, artists, tags, or set numbers')
    ).toBeVisible({ timeout: 45_000 });
    await expect
      .poll(async () => (await sessionCookie()).expires - Date.now() / 1000)
      .toBeGreaterThan(89 * 86400);
  });

  test('sign out returns to the auth wall', async ({ context, page }) => {
    await prepareSignedIn(context, page, '/search');
    await expect(
      page.getByPlaceholder('Search cards, artists, tags, or set numbers')
    ).toBeVisible();

    await page.getByLabel('Sign out').click();
    await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible({
      timeout: 30_000,
    });
  });
});
