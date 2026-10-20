import { expect, test } from '@playwright/test';
import { CollectionShareInviteCreateResponse } from '../../../packages/contracts/src/collection-share';
import { prepareSignedIn, goToTab } from './helpers/session';

test.describe('settings · shared collection', () => {
  test.beforeEach(async ({ context, page }) => {
    await prepareSignedIn(context, page, '/settings');
  });

  test('create invite link then cancel it', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.getByRole('button', { name: 'Create invite link' })).toBeVisible({
      timeout: 30_000,
    });
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/collection/share/invite') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create invite link' }).click();
    const response = await created;
    expect(response.status()).toBe(200);
    const invite = CollectionShareInviteCreateResponse.parse(
      await response.json()
    ).data;
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(invite.url);
    expect(new URL(invite.url).pathname).toBe(`/invite/${invite.token}`);
    await expect(page.getByRole('button', { name: 'Create new link' })).toBeVisible();

    await page.getByText('Cancel', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create invite link' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('theme choices are interactive', async ({ page }) => {
    await goToTab(page, 'Settings');
    await page.getByText('Light', { exact: true }).click();
    await page.getByText('Dark', { exact: true }).click();
    await expect(page.getByText('Shared collection', { exact: true })).toBeVisible();
  });
});
