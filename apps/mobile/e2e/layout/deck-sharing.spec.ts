import { expect, test } from '@playwright/test';
import { UpdateDeckSharingRequest } from '../../../../packages/contracts/src/decks';
import {
  corsHeaders,
  installMockApi,
  MOCK_API_ORIGIN,
  mockDeck,
} from '../helpers/mock-api';

const TOKEN = 'dshare_0123456789abcdef0123456789abcdef';

test('share menu enables, copies and revokes a public link without saving a stale deck', async ({
  context,
  page,
}, testInfo) => {
  await installMockApi(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let shared = false;
  const deckWrites: string[] = [];
  await context.route(`${MOCK_API_ORIGIN}/api/v1/decks/deck-0**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: corsHeaders() });
    if (request.method() === 'PATCH')
      shared = UpdateDeckSharingRequest.parse(request.postDataJSON()).enabled;
    if (request.method() === 'PUT') deckWrites.push(request.url());
    await route.fulfill({
      headers: corsHeaders(),
      json: { data: { ...mockDeck(0), shareToken: shared ? TOKEN : null } },
    });
  });
  await page.goto('/decks/deck-0');
  const menu = page
    .getByRole('button', { name: /^(Share deck|Deck options)$/ })
    .first();
  await menu.click();
  const access = page.getByRole('checkbox', {
    name: 'Anyone with the link',
    exact: true,
  });
  const copy = page.getByRole('menuitem', {
    name: 'Copy The Astral Grove link',
    exact: true,
  });
  await expect(access).not.toBeChecked();
  await expect(copy).toBeDisabled();
  await access.click();
  await expect(access).toBeChecked();
  await expect(copy).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('link-access.png') });
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`${new URL(page.url()).origin}/shared/decks/${TOKEN}`);
  await menu.click();
  await access.click();
  await expect(access).not.toBeChecked();
  await expect(copy).toBeDisabled();
  expect(shared).toBe(false);
  expect(deckWrites).toEqual([]);
});

test('shared links open anonymously and stop displaying the deck after revocation', async ({
  context,
  page,
}, testInfo) => {
  const mock = await installMockApi(context);
  await context.route(`${MOCK_API_ORIGIN}/api/auth/get-session**`, (route) =>
    route.fulfill({ headers: corsHeaders(), json: null })
  );
  let shared = true;
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(`${MOCK_API_ORIGIN}/api/v1/collection`))
      privateRequests.push(request.url());
  });
  await context.route(`${MOCK_API_ORIGIN}/api/v1/shared/decks/${TOKEN}`, (route) =>
    route.fulfill({
      status: shared ? 200 : 404,
      headers: { ...corsHeaders(), 'cache-control': 'no-store' },
      json: shared
        ? {
            data: {
              ...mockDeck(0),
              id: TOKEN,
              source: 'owned',
              shareToken: TOKEN,
              readOnly: true,
              versions: undefined,
            },
          }
        : { error: 'Deck not found' },
    })
  );
  await page.goto(`/shared/decks/${TOKEN}`);
  await expect(
    page.getByText('Shared via The Astral Grove · View only', { exact: true })
  ).toBeVisible();
  await expect(page.getByText(mockDeck(0).name, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit deck', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Import to my decks', exact: true })
  ).toHaveCount(0);
  expect(privateRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('anonymous-deck.png') });
  shared = false;
  await page.reload();
  await expect(
    page.getByText('This deck is no longer shared.', { exact: true })
  ).toBeVisible();
  await expect(page.getByText(mockDeck(0).name, { exact: true })).toHaveCount(0);
  expect(mock.unhandled).toEqual([]);
});

test('shared links distinguish a temporary failure from revocation and can retry', async ({
  context,
  page,
}) => {
  await installMockApi(context);
  await context.route(`${MOCK_API_ORIGIN}/api/auth/get-session**`, (route) =>
    route.fulfill({ headers: corsHeaders(), json: null })
  );
  let unavailable = true;
  await context.route(`${MOCK_API_ORIGIN}/api/v1/shared/decks/${TOKEN}`, (route) =>
    route.fulfill({
      status: unavailable ? 503 : 200,
      headers: corsHeaders(),
      json: unavailable
        ? { error: 'Fixture temporarily unavailable' }
        : {
            data: {
              ...mockDeck(0),
              id: TOKEN,
              source: 'owned',
              shareToken: TOKEN,
              readOnly: true,
              versions: undefined,
            },
          },
    })
  );
  await page.goto(`/shared/decks/${TOKEN}`);
  await expect(
    page.getByText('Could not load this deck. Please try again.')
  ).toBeVisible();
  await expect(page.getByText('This deck is no longer shared.')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText(mockDeck(0).name, { exact: true }).first()).toBeVisible();
});
