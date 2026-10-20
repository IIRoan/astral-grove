import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const FOIL_CARD = {
  query: 'OGN-015',
  name: 'Captain Farron',
  standardId: 'OGN-015',
  foilId: 'OGN-015-Foil',
} as const;

/** Multi-family card used to assert promo/overnumbered stay off the standard row. */
export const MULTI_FAMILY_CARD = {
  query: 'OGN-253',
  name: 'Darius, Hand of Noxus',
  standardId: 'OGN-253',
  promoId: 'OGN-253-Release',
  promoLabel: 'Release Event Promo',
} as const;

export async function searchForCard(
  page: Page,
  query: string,
  cardName: string
): Promise<void> {
  const search = page.getByPlaceholder('Search cards, artists, tags, or set numbers');
  await search.fill(query);
  await expect(cardTile(page, cardName, query)).toBeVisible({ timeout: 30_000 });
}

export async function switchToListView(page: Page): Promise<void> {
  const listToggle = page.getByLabel('List view', { exact: true });
  if (await listToggle.count()) {
    await listToggle.click();
  }
}

/** Search-result tile (not the detail panel, which duplicates steppers). */
export function cardTile(page: Page, cardName: string, variantNumber: string): Locator {
  return page
    .getByRole('button')
    .filter({ has: page.getByText(cardName, { exact: true }) })
    .filter({ has: page.getByText(variantNumber, { exact: true }) });
}

export function addToCollectionButton(
  page: Page,
  cardName: string,
  variantNumber: string
): Locator {
  return cardTile(page, cardName, variantNumber)
    .locator('..')
    .getByLabel(`Add ${cardName} to collection`, {
      exact: true,
    });
}

export function addOneButton(
  page: Page,
  cardName: string,
  variantNumber: string
): Locator {
  return cardTile(page, cardName, variantNumber)
    .locator('..')
    .getByLabel(`Add one ${cardName}`, {
      exact: true,
    });
}

export function removeOneButton(
  page: Page,
  cardName: string,
  variantNumber: string
): Locator {
  return cardTile(page, cardName, variantNumber)
    .locator('..')
    .getByLabel(`Remove one ${cardName}`, {
      exact: true,
    });
}

/** Mirrors collectionFinishKey — picker testIDs use `VN::std` / `VN::foil`. */
export function printingOptionId(variantNumber: string): string {
  return `${variantNumber}::${/foil/i.test(variantNumber) ? 'foil' : 'std'}`;
}

export function printingOption(page: Page, variantNumber: string): Locator {
  return page.getByTestId(`printing-option-${printingOptionId(variantNumber)}`);
}

export async function pickPrinting(page: Page, variantNumber: string): Promise<void> {
  const option = printingOption(page, variantNumber);
  await expect(option).toBeVisible();
  await option.click();
}

export async function enableSimpleAdd(page: Page): Promise<void> {
  const toggle = page.getByRole('switch', { name: 'Quick add', exact: true });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== 'true') {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
}

export function detailWishlistButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /Add to wishlist|Remove from wishlist|Wishlisted/,
  });
}
