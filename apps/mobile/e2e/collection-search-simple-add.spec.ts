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
  enableSimpleAdd,
  pickPrinting,
  printingOption,
  removeOneButton,
  searchForCard,
} from './helpers/collection';

test.describe('search collection · simple add', () => {
  test.beforeEach(async ({ context, page }) => {
    await installLocalApiOverride(context);
    await signUpAndHydrateSession(context);
    await gotoSignedInSearch(page);
  });

  test('enabling simple add skips the foil picker and inserts the standard finish', async ({
    page,
  }) => {
    await enableSimpleAdd(page);
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);

    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();

    await expect(printingOption(page, FOIL_CARD.standardId)).toHaveCount(0);
    await expect(printingOption(page, FOIL_CARD.foilId)).toHaveCount(0);
    await expect(
      removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();

    // Default finish is non-foil — remove targets it without asking.
    await removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(printingOption(page, FOIL_CARD.foilId)).toHaveCount(0);
    await expect(printingOption(page, FOIL_CARD.standardId)).toHaveCount(0);
    await expect(
      addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();
  });

  test('simple add still asks which finish to remove when both are owned', async ({
    page,
  }) => {
    await searchForCard(page, FOIL_CARD.query, FOIL_CARD.name);

    // Own foil first (picker path), then enable simple add and own standard.
    await addToCollectionButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await pickPrinting(page, FOIL_CARD.foilId);
    await expect(
      addOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId)
    ).toBeVisible();

    await enableSimpleAdd(page);

    await addOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(printingOption(page, FOIL_CARD.standardId)).toHaveCount(0);
    await expect(printingOption(page, FOIL_CARD.foilId)).toHaveCount(0);

    await removeOneButton(page, FOIL_CARD.name, FOIL_CARD.standardId).click();
    await expect(printingOption(page, FOIL_CARD.standardId)).toBeVisible();
    await expect(printingOption(page, FOIL_CARD.foilId)).toBeVisible();
  });
});
