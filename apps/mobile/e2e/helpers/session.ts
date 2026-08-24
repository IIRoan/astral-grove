import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  installLocalApiOverride,
  signUpAndHydrateSession,
  type UiE2eUser,
} from './auth';

/** Fresh signed-in browser context ready for UI flows. */
export async function prepareSignedIn(
  context: BrowserContext,
  page: Page,
  path = '/search'
): Promise<UiE2eUser> {
  await installLocalApiOverride(context);
  const user = await signUpAndHydrateSession(context);
  await page.goto(path);
  await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveCount(0, {
    timeout: 45_000,
  });
  return user;
}

/** Desktop side rail (viewport ≥1280). Search tab is labeled "Cards". */
export async function goToTab(
  page: Page,
  tab: 'Cards' | 'Collection' | 'Wishlist' | 'Decks' | 'Settings'
): Promise<void> {
  if (tab === 'Settings') {
    await page.goto('/settings');
    await expect(page.getByText('Shared collection', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    return;
  }

  if (tab === 'Cards') {
    await page.getByLabel('Cards', { exact: true }).click();
    await expect(
      page.getByPlaceholder('Search cards, artists, tags, or set numbers')
    ).toBeVisible({ timeout: 30_000 });
    return;
  }

  await page.getByLabel(tab, { exact: true }).click();
}
