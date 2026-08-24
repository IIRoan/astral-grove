import { expect, test } from '@playwright/test';
import { prepareSignedIn } from './helpers/session';

test.describe('decks', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/decks');
  });

  test('empty owned decks shows create CTA', async ({ page }) => {
    await expect(page.getByText('No decks yet')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Create your first deck' })
    ).toBeVisible();
  });

  test('create deck opens legend picker', async ({ page }) => {
    await page.getByRole('button', { name: 'Create your first deck' }).click();
    await expect(page.getByText('Choose your Legend')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByPlaceholder('Search legends')).toBeVisible();
  });

  test('selecting a legend opens the builder then returns a deck on Mine', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Create your first deck' }).click();
    await expect(page.getByText('Choose your Legend')).toBeVisible({ timeout: 45_000 });

    // Wait for legends to load, then pick the first available one.
    const firstLegend = page.getByLabel(/^Select /).first();
    await expect(firstLegend).toBeVisible({ timeout: 45_000 });
    await firstLegend.click();

    // Builder chrome (legend applied — picker gone).
    await expect(page.getByLabel('Back to deck')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Choose your Legend')).toHaveCount(0);
    await expect(page.getByLabel('Export deck list')).toBeVisible({ timeout: 30_000 });

    // Edit back returns to view-only profile, then to My decks.
    await page.getByLabel('Back to deck').click();
    await expect(page.getByLabel('Edit deck')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Back to decks')).toBeVisible();
    await page.getByLabel('Back to decks').click();
    await expect(page.getByText('My decks', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('No decks yet')).toHaveCount(0);
    await expect(page.getByLabel(/New Deck\./)).toBeVisible({ timeout: 15_000 });
  });

  test('browse tab lists community decks', async ({ page }) => {
    await page.goto('/decks/browse');
    await expect(page.getByText('Browse decks', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByPlaceholder('Search decks, legends, or tags')).toBeVisible({
      timeout: 30_000,
    });
  });
});
