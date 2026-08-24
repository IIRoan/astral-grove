import { expect, test } from '@playwright/test';
import {
  gotoSignedInSearch,
  installLocalApiOverride,
  signUpAndHydrateSession,
} from './helpers/auth';
import {
  FOIL_CARD,
  addOneButton,
  addToCollectionButton,
  pickPrinting,
  printingOption,
  removeOneButton,
  searchForCard,
} from './helpers/collection';

test.describe('search collection foil / standard', () => {
  test.beforeEach(async ({ context, page }) => {
    await installLocalApiOverride(context);
    await signUpAndHydrateSession(context);
    await gotoSignedInSearch(page);
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);
  });

  test('add foil from search, then remove without a picker when only foil is owned', async ({
    page,
  }) => {
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.foilId);

    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toHaveCount(0);

    // Foil-only: − should not open a printing menu — it targets the owned foil.
    await removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(printingOption(page, FOIL_CARD.foilId)).toHaveCount(0);
    await expect(printingOption(page, FOIL_CARD.standardId)).toHaveCount(0);

    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
  });

  test('add standard from search, then remove it', async ({ page }) => {
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);

    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
    await removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
  });

  test('when both printings are owned, remove opens a picker', async ({ page }) => {
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.standardId);
    await expect(
      addOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();

    await addOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.foilId);

    await removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(printingOption(page, FOIL_CARD.standardId)).toBeVisible();
    await expect(printingOption(page, FOIL_CARD.foilId)).toBeVisible();

    await pickPrinting(page, FOIL_CARD.foilId);
    // Still own standard — stepper stays; Add button does not return.
    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toHaveCount(0);
  });
});
