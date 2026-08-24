import { expect, test } from '@playwright/test';
import {
  FOIL_CARD,
  MULTI_FAMILY_CARD,
  addOneButton,
  addToCollectionButton,
  cardTile,
  detailWishlistButton,
  pickPrinting,
  removeOneButton,
  searchForCard,
  switchToListView,
} from './helpers/collection';
import { prepareSignedIn } from './helpers/session';

test.describe('catalog ownership on list + detail', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/search');
    await switchToListView(page);
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);
  });

  test('list tile shows owned count after add without needing a second click', async ({
    page,
  }) => {
    const tile = cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId);
    await expect(tile.getByText('Not owned')).toBeVisible();

    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);

    await expect(tile.getByText('Owned ×1')).toBeVisible({ timeout: 30_000 });
    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
  });

  test('grid tile swaps Add for owned stepper immediately after add', async ({
    page,
  }) => {
    await page.getByLabel('Grid view', { exact: true }).click();
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);

    const tile = cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId);
    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();

    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);

    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toHaveCount(0);
    await expect(tile.getByText('1', { exact: true })).toBeVisible();
  });

  test('detail owned qty updates when incrementing from the list stepper', async ({
    page,
  }) => {
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);
    await expect(
      cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).getByText('Owned ×1')
    ).toBeVisible();

    await addOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);
    await expect(
      cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).getByText('Owned ×2')
    ).toBeVisible({ timeout: 30_000 });

    await cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(detailWishlistButton(page)).toBeVisible({ timeout: 30_000 });
    // Split layout keeps the list badge and detail Owned stat in sync.
    await expect(
      cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).getByText('Owned ×2')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Wishlist/ })).toBeVisible();
  });

  test('opening detail keeps collection controls for the active printing', async ({
    page,
  }) => {
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);

    await cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(detailWishlistButton(page)).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(FOIL_CARD.standardId, { exact: true }).first()
    ).toBeVisible();

    // Std + foil: detail lists finishes with steppers instead of a single CTA.
    await expect(
      page.getByText(FOIL_CARD.foilId, { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByLabel(new RegExp(`Add .*${FOIL_CARD.name}`)).first()
    ).toBeVisible();
  });
});

test.describe('catalog price scoping', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/search');
    await switchToListView(page);
  });

  test('standard search row does not list promo printing ids', async ({ page }) => {
    await searchForCard(page, MULTI_FAMILY_CARD.query, MULTI_FAMILY_CARD.name);

    const standardTile = cardTile(
      page,
      MULTI_FAMILY_CARD.name,
      MULTI_FAMILY_CARD.standardId
    );
    await expect(standardTile).toBeVisible();
    await expect(standardTile).not.toContainText(MULTI_FAMILY_CARD.promoId);
    await expect(standardTile).not.toContainText(MULTI_FAMILY_CARD.promoLabel);
  });

  test('opening the standard printing keeps promo off the active detail until switched', async ({
    page,
  }) => {
    await searchForCard(page, MULTI_FAMILY_CARD.query, MULTI_FAMILY_CARD.name);
    await cardTile(page, MULTI_FAMILY_CARD.name, MULTI_FAMILY_CARD.standardId).click();

    await expect(detailWishlistButton(page)).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: `View ${MULTI_FAMILY_CARD.name} full size` })
    ).toContainText(MULTI_FAMILY_CARD.standardId);

    // Separate search rows: selecting the promo printing updates the detail panel.
    await cardTile(page, MULTI_FAMILY_CARD.name, MULTI_FAMILY_CARD.promoId).click();
    await expect(
      page.getByRole('button', { name: `View ${MULTI_FAMILY_CARD.name} full size` })
    ).toContainText(MULTI_FAMILY_CARD.promoId, { timeout: 15_000 });
    await expect(page.getByText(MULTI_FAMILY_CARD.promoLabel).first()).toBeVisible();
  });

  test('foil card detail shows a single active market price summary', async ({
    page,
  }) => {
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);
    await cardTile(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(detailWishlistButton(page)).toBeVisible({ timeout: 30_000 });

    // Active printing price uses €…; unrelated promo codes should not appear.
    await expect(page.getByText(/€\d/).first()).toBeVisible();
    await expect(
      page.getByText(MULTI_FAMILY_CARD.promoId, { exact: true })
    ).toHaveCount(0);
  });
});
