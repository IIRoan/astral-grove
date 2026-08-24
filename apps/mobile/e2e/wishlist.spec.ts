import { expect, test } from '@playwright/test';
import { FOIL_CARD, cardTile, searchForCard } from './helpers/collection';
import { prepareSignedIn, goToTab } from './helpers/session';

test.describe('wishlist', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/search');
  });

  test('wishlist from detail panel appears on wishlist tab', async ({ page }) => {
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);
    await cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).click();

    const wishlistBtn = page.getByRole('button', { name: 'Add to wishlist' });
    await expect(wishlistBtn).toBeVisible({ timeout: 30_000 });
    await wishlistBtn.click();

    await expect(page.getByText('Add which printing?')).toBeVisible({
      timeout: 10_000,
    });
    await page
      .locator('[data-slot="inline-list-item-title"]', { hasText: 'Standard' })
      .click();

    await expect(
      page.getByRole('button', { name: /Remove from wishlist|Wishlisted/ })
    ).toBeVisible({
      timeout: 15_000,
    });

    await goToTab(page, 'Wishlist');
    await expect(page.getByText(FOIL_CARD.name, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('No wishlist cards yet')).toHaveCount(0);
  });

  test('empty wishlist shows guidance copy', async ({ page }) => {
    await goToTab(page, 'Wishlist');
    await expect(page.getByText('No wishlist cards yet')).toBeVisible();
  });
});
