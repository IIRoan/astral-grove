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
    await page
      .getByRole('menuitem', { name: 'Create Constructed deck', exact: true })
      .click();
    await expect(
      page.getByText('Choose your Legend').filter({ visible: true })
    ).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByPlaceholder('Search legends').filter({ visible: true })
    ).toBeVisible();
  });

  test('selecting a legend opens the builder then returns a deck on Mine', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Create your first deck' }).click();
    await page
      .getByRole('menuitem', { name: 'Create Constructed deck', exact: true })
      .click();
    await expect(
      page.getByText('Choose your Legend').filter({ visible: true })
    ).toBeVisible({
      timeout: 45_000,
    });

    const legend = page
      .getByRole('button', { name: 'Select Ahri, Nine-Tailed Fox', exact: true })
      .first();
    await expect(legend).toBeVisible({ timeout: 45_000 });
    await legend.click();

    // Builder chrome (legend applied — picker gone).
    await expect(
      page.getByRole('button', { name: 'Back to deck', exact: true })
    ).toBeVisible({ timeout: 45_000 });
    await expect(
      page.getByText('Choose your Legend').filter({ visible: true })
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Share deck', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Copy TTS list' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Copy TTS list' }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(
        [
          'OGN-255-1',
          ...Array(6).fill('OGN-042-1'),
          ...Array(6).fill('OGN-089-1'),
        ].join(' ')
      );
    await expect(page.getByRole('menuitem', { name: 'Copy TTS list' })).toHaveCount(0);

    // Edit back returns to view-only profile, then to My decks.
    await page.getByRole('button', { name: 'Back to deck', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Edit deck', exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Back to decks', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to decks', exact: true }).click();
    await expect(
      page.getByText('My decks', { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('No decks yet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /New Deck\./ })).toBeVisible({
      timeout: 15_000,
    });
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
