import { expect, test } from '@playwright/test';
import { prepareSignedIn, goToTab } from './helpers/session';

test.describe('desktop navigation', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/search');
  });

  test('side rail reaches collection, wishlist, decks, and settings', async ({
    page,
  }) => {
    await goToTab(page, 'Collection');
    await expect(page.getByText('Your collection', { exact: true })).toBeVisible();

    await goToTab(page, 'Wishlist');
    await expect(page.getByText('Wishlist', { exact: true }).first()).toBeVisible();

    await goToTab(page, 'Decks');
    await expect(page.getByText('My decks', { exact: true })).toBeVisible();

    await goToTab(page, 'Settings');
    await expect(page.getByText('Shared collection', { exact: true })).toBeVisible();

    await goToTab(page, 'Cards');
    await expect(
      page.getByPlaceholder('Search cards, artists, tags, or set numbers')
    ).toBeVisible();
  });
});
