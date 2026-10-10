import { expect, test } from '@playwright/test';
import { installMockApi, MOCK_API_ORIGIN } from '../helpers/mock-api';
import { auditLayout, formatIssues } from '../helpers/layout-audit';

const events = Array.from({ length: 23 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  at: new Date(Date.UTC(2026, 9, 9 - index, 12)).toISOString(),
  action: index % 2 === 0 ? 'add' : 'remove',
  quantityDelta: index % 2 === 0 ? 1 : -1,
  quantityAfter: index % 2 === 0 ? 3 : 2,
  isFoil: index % 2 === 0,
  actor: { userId: 'partner', name: 'Rowan Collector', email: null },
}));

test('opens, pages, retries and collapses collection history', async ({
  context,
  page,
}, testInfo) => {
  await installMockApi(context);
  const headers = {
    'access-control-allow-origin': 'http://localhost:7011',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
  await context.route(`${MOCK_API_ORIGIN}/api/v1/collection/recent-adds`, (route) =>
    route.fulfill({ json: { data: events.slice(0, 3) }, headers })
  );
  let failOlderPage = true;
  let historyRequests = 0;
  await context.route(
    `${MOCK_API_ORIGIN}/api/v1/collection/activity-history`,
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      historyRequests++;
      const input: unknown = route.request().postDataJSON();
      const older = typeof input === 'object' && input !== null && 'cursor' in input;
      if (older && failOlderPage) {
        await route.fulfill({
          status: 503,
          json: { error: 'temporarily unavailable' },
          headers,
        });
        return;
      }
      const data = older ? events.slice(20) : events.slice(0, 20);
      const last = data.at(-1)!;
      await route.fulfill({
        json: {
          data,
          meta: {
            hasMore: !older,
            nextCursor: older ? null : { at: last.at, id: last.id },
          },
        },
        headers,
      });
    }
  );

  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
    .first()
    .click();
  const viewHistory = page.getByRole('button', { name: 'View history', exact: true });
  await expect(viewHistory).toBeVisible();
  expect(historyRequests).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('compact-history.png') });
  await viewHistory.focus();
  await viewHistory.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Hide history', exact: true })
  ).toBeFocused();
  await expect(page.getByText('Collection history', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Load older activity', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load older activity', exact: true }).click();
  await expect(
    page.getByText('Couldn’t load collection history. Try again.')
  ).toBeVisible({ timeout: 30_000 });
  failOlderPage = false;
  await page.getByRole('button', { name: 'Retry loading collection history' }).click();
  await expect(
    page.getByText('You’ve reached the start of this card’s history.')
  ).toBeVisible();
  await expect(
    page.getByText('Added 1 Foil copy · now 3', { exact: true })
  ).toHaveCount(12);
  await expect(
    page.getByText('Removed 1 Standard copy · now 2', { exact: true })
  ).toHaveCount(11);
  await expect(
    page.getByRole('button', { name: 'Load older activity', exact: true })
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Hide history', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('expanded-history.png') });
  const issues = await auditLayout(page);
  expect(issues, formatIssues(issues)).toEqual([]);
  const hideHistory = page.getByRole('button', { name: 'Hide history', exact: true });
  await hideHistory.focus();
  await hideHistory.press('Enter');
  await expect(viewHistory).toBeVisible();
  await expect(viewHistory).toBeFocused();
  await expect(page.getByText('Collection history', { exact: true })).toHaveCount(0);
});
