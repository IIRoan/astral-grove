import { expect, test, type Page } from '@playwright/test';
import { CardsListResponse } from '../../../packages/contracts/src/cards';
import { CollectionQuantitiesResponse } from '../../../packages/contracts/src/collection';
import { installLocalApiOverride, signUpAndHydrateSession } from './helpers/auth';
import { API_URL } from './helpers/env';
import { selectCatalogFilter } from './helpers/catalog';
import { pickPrinting } from './helpers/collection';

async function quantity(page: Page, variantNumber: string, isFoil = false) {
  const body: unknown = await page.evaluate(
    async ({ apiUrl, variantNumber }) => {
      const response = await fetch(`${apiUrl}/api/v1/collection/quantities`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantNumbers: [variantNumber] }),
      });
      if (!response.ok) throw new Error(`Quantity lookup failed: ${response.status}`);
      return response.json();
    },
    { apiUrl: API_URL, variantNumber }
  );
  return (
    CollectionQuantitiesResponse.parse(body).data.find(
      (row) => row.variantNumber === variantNumber && row.isFoil === isFoil
    )?.quantity ?? 0
  );
}

for (const mobile of [true, false]) {
  test.describe(mobile ? 'phone with real API' : 'desktop with real API', () => {
    test.use({
      viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    test.beforeEach(async ({ context, page }) => {
      await installLocalApiOverride(context);
      await signUpAndHydrateSession(context);
      await page.goto('/search');
      await expect(page.getByPlaceholder(/Search cards/)).toBeVisible();
    });

    test('adds, increments, reloads and removes the persisted standard finish', async ({
      page,
    }) => {
      await page.getByPlaceholder(/Search cards/).fill('OGN-015');
      const card = page
        .getByRole('button', { name: 'Captain Farron', exact: true })
        .first();
      await expect(card).toBeVisible();
      await page
        .getByRole('button', { name: 'Add Captain Farron to collection', exact: true })
        .first()
        .click();
      await pickPrinting(page, 'OGN-015');
      await expect(card).toContainText('Owned ×1', { timeout: 2000 });
      await page
        .getByRole('button', { name: 'Add one Captain Farron', exact: true })
        .first()
        .click();
      await pickPrinting(page, 'OGN-015');
      await expect(card).toContainText('Owned ×2', { timeout: 2000 });
      await expect.poll(() => quantity(page, 'OGN-015')).toBe(2);
      await page.reload();
      await page.getByPlaceholder(/Search cards/).fill('OGN-015');
      await expect(card).toContainText('Owned ×2');
      await page
        .getByRole('button', { name: 'Remove one Captain Farron', exact: true })
        .first()
        .click();
      await expect(card).toContainText('Owned ×1', { timeout: 2000 });
      await expect.poll(() => quantity(page, 'OGN-015')).toBe(1);
      await page
        .getByRole('button', { name: 'Remove one Captain Farron', exact: true })
        .first()
        .click();
      await expect(
        page
          .getByRole('button', {
            name: 'Add Captain Farron to collection',
            exact: true,
          })
          .first()
      ).toBeVisible();
      await expect.poll(() => quantity(page, 'OGN-015')).toBe(0);
    });

    test('keeps foil and standard counts separate across a reload', async ({
      page,
    }) => {
      await page.getByPlaceholder(/Search cards/).fill('OGN-015');
      await page
        .getByRole('button', { name: 'Add Captain Farron to collection', exact: true })
        .first()
        .click();
      await pickPrinting(page, 'OGN-015-Foil');
      await expect.poll(() => quantity(page, 'OGN-015-Foil', true)).toBe(1);
      await expect.poll(() => quantity(page, 'OGN-015')).toBe(0);
      await page.reload();
      await page.getByPlaceholder(/Search cards/).fill('OGN-015');
      const card = page
        .getByRole('button', { name: 'Captain Farron', exact: true })
        .first();
      await expect(card).toContainText('Owned ×1');
      await page
        .getByRole('button', { name: 'Remove one Captain Farron', exact: true })
        .first()
        .click();
      await expect.poll(() => quantity(page, 'OGN-015-Foil', true)).toBe(0);
      await expect(
        page
          .getByRole('button', {
            name: 'Add Captain Farron to collection',
            exact: true,
          })
          .first()
      ).toBeVisible();
    });

    test('filters colored Legends, searches and reverses their visible sort order', async ({
      page,
    }) => {
      const response = await fetch(
        `${API_URL}/api/v1/cards?types=Legend&colors=Calm&sortBy=name&dir=desc&limit=100`
      );
      const legends = CardsListResponse.parse(await response.json()).data;
      expect(legends.length).toBeGreaterThan(1);
      const names = [...new Set(legends.map((card) => card.name))];
      await selectCatalogFilter(page, 'Type', 'Legend');
      await selectCatalogFilter(page, 'Colors', 'Calm');
      await page.getByPlaceholder(/Search cards/).fill('Ahri');
      await expect(page.getByRole('button', { name: /^Ahri/ }).first()).toBeVisible({
        timeout: 2000,
      });
      await page.getByPlaceholder(/Search cards/).fill('');
      await page.getByLabel('Sort: Name (A–Z)', { exact: true }).click();
      await page.getByText('Name (Z–A)', { exact: true }).click();
      await expect(page.getByLabel('Sort: Name (Z–A)', { exact: true })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate((names) => {
            const allowed = new Set(names);
            return [...document.querySelectorAll('[role="button"][aria-label]')]
              .map((el) => ({
                name: el.getAttribute('aria-label'),
                box: el.getBoundingClientRect(),
              }))
              .filter(
                ({ name, box }) =>
                  allowed.has(name ?? '') &&
                  box.width > 0 &&
                  box.height > 0 &&
                  box.y >= 0 &&
                  box.y < innerHeight
              )
              .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)[0]?.name;
          }, names)
        )
        .toBe(legends[0]!.name);
      await page.getByLabel('Sort: Name (Z–A)', { exact: true }).click();
      await page.getByText('Name (A–Z)', { exact: true }).click();
      await expect(page.getByLabel('Sort: Name (A–Z)', { exact: true })).toBeVisible();
    });
  });
}
