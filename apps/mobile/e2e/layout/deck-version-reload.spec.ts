import { expect, test } from '@playwright/test';
import {
  corsHeaders,
  installMockApi,
  MOCK_API_ORIGIN,
  mockDeck,
} from '../helpers/mock-api';

const version = (id: string, name: string, isActive: boolean) => ({
  id,
  name,
  createdAt: 1,
  updatedAt: 1,
  isActive,
});

const base = mockDeck(0);
const saved = {
  ...base,
  // A Legend with no runes gets runes filled in, which is a real edit.
  runes: [base.mainDeck[4]!],
  versionId: 'v-new',
  versionName: 'RADIANCE',
  versions: [version('v-old', 'Current', false), version('v-new', 'RADIANCE', true)],
};

// What an older visit left on disk: the deck while it was still empty, on the old version.
const staleSnapshot = {
  ...saved,
  legend: null,
  mainDeck: [],
  updatedAt: 1,
  versionId: 'v-old',
  versionName: 'Current',
  versions: [version('v-old', 'Current', true)],
};

test('opening the editor writes nothing, so a stale snapshot cannot wipe a version', async ({
  context,
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1024,
    'Side-by-side builder is desktop'
  );
  await installMockApi(context);
  // The disk cache only loads for the same signed-in user, so stamp the mock user too.
  await context.addInitScript((snapshot) => {
    localStorage.setItem('riftbound_last_user_id', 'layout-user-0001');
    localStorage.setItem(
      'riftbound_owned_decks_cache',
      JSON.stringify({ cachedAt: Date.now(), decks: [snapshot] })
    );
  }, staleSnapshot);

  const writes: string[] = [];
  const mock = (url: string | RegExp, json: unknown) =>
    context.route(url, (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: corsHeaders() });
      }
      if (request.method() === 'PUT') writes.push(new URL(request.url()).pathname);
      return route.fulfill({ headers: corsHeaders(), json });
    });
  await mock(`${MOCK_API_ORIGIN}/api/v1/decks/deck-0**`, { data: saved });
  await mock(/\/api\/v1\/decks(\?.*)?$/, {
    data: [saved],
    meta: { total: 1, owned: 1, imported: 0 },
  });

  await page.goto('/decks/deck-0?mode=edit');
  await expect(
    page
      .getByRole('button', { name: 'Deck version RADIANCE', exact: true })
      .filter({ visible: true })
      .first()
  ).toBeVisible();
  // Longer than the autosave debounce.
  await page.waitForTimeout(3_000);

  expect(writes).toEqual([]);
});
