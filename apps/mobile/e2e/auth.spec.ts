import { expect, test } from '@playwright/test';
import { installLocalApiOverride } from './helpers/auth';
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
