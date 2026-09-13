import { expect, test } from '@playwright/test';
import {
  FOIL_CARD,
  addToCollectionButton,
  pickPrinting,
  removeOneButton,
  searchForCard,
} from './helpers/collection';
import { prepareSignedIn, goToTab } from './helpers/session';

test.describe('collection', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/search');
  });

  test('empty collection offers search CTA', async ({ page }) => {
    await goToTab(page, 'Collection');
    await expect(page.getByRole('button', { name: 'Search cards' })).toBeVisible();
    await page.getByRole('button', { name: 'Search cards' }).click();
    await expect(
      page.getByPlaceholder('Search cards, artists, tags, or set numbers')
    ).toBeVisible();
  });

  test('set card opens missing cards from that set', async ({ page }) => {
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);
    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();

    await goToTab(page, 'Collection');
    await expect(page.getByText('Your collection', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Search your collection')).toHaveCount(0);

    const origins = page.getByRole('button', { name: /Origins,/ });
    await expect(origins).toBeVisible({ timeout: 30_000 });
    await origins.click();
    await expect(page.getByLabel('Search missing cards')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/missing/i).first()).toBeVisible();

    await page.getByLabel('Search missing cards').fill(FOIL_CARD.name);
    await expect(
      page.getByRole('button', {
        name: new RegExp(`${FOIL_CARD.name}.*${FOIL_CARD.standardId}`),
      })
    ).toHaveCount(0);
  });
});
