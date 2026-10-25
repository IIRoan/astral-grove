import { expect, test } from '@playwright/test';
import { installMockApi, MOCK_API_ORIGIN, mockCard } from '../helpers/mock-api';
import { selectCatalogFilter as selectFilter } from '../helpers/catalog';

const headers = {
  'access-control-allow-origin': 'http://localhost:7011',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

test('keeps the catalog usable when search results shrink and grow', async ({
  context,
  page,
}) => {
  const layoutErrors: string[] = [];
  page.on('pageerror', (error) => layoutErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') layoutErrors.push(message.text());
  });
  await installMockApi(context);
  await context.route(`${MOCK_API_ORIGIN}/api/v1/cards?*`, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q');
    if (query === null) return route.fallback();
    const data = Array.from({ length: 48 }, (_, index) => mockCard(index)).filter(
      (card) => card.name.toLowerCase().includes(query.toLowerCase())
    );
    await route.fulfill({
      json: {
        data,
        meta: {
          pagination: {
            total: data.length,
            page: 1,
            limit: 100,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
          source: 'cache',
          catalogHash: 'layout-hash',
        },
      },
      headers,
    });
  });
  await page.goto('/search');
  const ahri = page.getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true });
  await expect(ahri.first()).toBeVisible();
  const search = page.getByPlaceholder(/Search cards/);
  for (let cycle = 0; cycle < 2; cycle++) {
    await search.fill('Ahri');
    await expect(ahri.first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jinx', exact: true })).toHaveCount(
      0
    );
    await search.fill('no-matching-card');
    await expect(ahri).toHaveCount(0);
    await search.fill('Jinx');
    await expect(
      page.getByRole('button', { name: 'Jinx', exact: true }).first()
    ).toBeVisible();
    await search.fill('');
    await expect(ahri.first()).toBeVisible();
  }
  expect(layoutErrors.filter((message) => /not enough layouts/.test(message))).toEqual(
    []
  );
});

test('searches colored Legends from the cache before the server responds', async ({
  context,
  page,
}) => {
  await installMockApi(context);
  let releaseSearch!: () => void;
  const pendingSearch = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  let searchFinished = false;
  await context.route(`${MOCK_API_ORIGIN}/api/v1/cards?*`, async (route) => {
    if (!new URL(route.request().url()).searchParams.has('q')) {
      await route.fallback();
      return;
    }
    await pendingSearch;
    searchFinished = true;
    await route.fallback();
  });
  try {
    await page.goto('/search');
    await expect(
      page
        .getByRole('button', { name: 'Blade of the Ruined King', exact: true })
        .first()
    ).toBeVisible();
    await selectFilter(page, 'Type', 'Legend');
    await selectFilter(page, 'Colors', 'Body');
    await page.getByPlaceholder(/Search cards/).fill('Blade');
    await expect(
      page
        .getByRole('button', { name: 'Blade of the Ruined King', exact: true })
        .first()
    ).toBeVisible({ timeout: 2000 });
    expect(searchFinished).toBe(false);
    await expect(
      page.getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
    ).toHaveCount(0);
  } finally {
    releaseSearch();
  }
});

test('keeps optimistic quantities through delayed adds and filtered search', async ({
  context,
  page,
}) => {
  await installMockApi(context);
  let releaseAdd!: () => void;
  const pendingAdd = new Promise<void>((resolve) => {
    releaseAdd = resolve;
  });
  let addFinished = false;
  await context.route(
    `${MOCK_API_ORIGIN}/api/v1/collection/OGN-001/add`,
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      await pendingAdd;
      addFinished = true;
      await route.fulfill({ json: { data: { ok: true } }, headers });
    }
  );
  await context.route(`${MOCK_API_ORIGIN}/api/v1/cards?*`, async (route) => {
    if (new URL(route.request().url()).searchParams.has('q')) {
      await route.fulfill({
        json: {
          data: [mockCard(6)],
          meta: {
            pagination: {
              total: 1,
              page: 1,
              limit: 60,
              totalPages: 1,
              hasNext: false,
              hasPrevious: false,
            },
            source: 'cache',
            catalogHash: 'layout-hash',
          },
        },
        headers,
      });
      return;
    }
    await route.fallback();
  });
  try {
    await page.goto('/search');
    await page
      .getByRole('button', {
        name: 'Add Ahri, Nine-Tailed Fox to collection',
        exact: true,
      })
      .first()
      .click();
    const ownedCard = page
      .getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
      .filter({ hasText: 'Owned ×1' });
    await expect(ownedCard).toBeVisible({ timeout: 2000 });
    expect(addFinished).toBe(false);
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await selectFilter(page, 'Collection', 'Owned');
    } else {
      await page.getByRole('tab', { name: 'Owned cards', exact: true }).click();
    }
    await page.getByPlaceholder(/Search cards/).fill('Ahri');
    await expect(ownedCard).toBeVisible({ timeout: 2000 });
    releaseAdd();
    await expect.poll(() => addFinished).toBe(true);
    await expect(ownedCard).toBeVisible();
  } finally {
    releaseAdd();
  }
});

test('keeps another pending add when an earlier add fails', async ({
  context,
  page,
}) => {
  await installMockApi(context);
  let rejectFirst!: () => void;
  let releaseSecond!: () => void;
  const first = new Promise<void>((resolve) => {
    rejectFirst = resolve;
  });
  const second = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  let firstFailed = false;
  await context.route(`${MOCK_API_ORIGIN}/api/v1/collection/*/add`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (route.request().url().includes('/OGN-001/')) {
      await first;
      await route.fulfill({
        status: 503,
        json: { error: 'temporarily unavailable' },
        headers,
      });
      firstFailed = true;
    } else {
      await second;
      await route.fulfill({ json: { data: { ok: true } }, headers });
    }
  });
  try {
    await page.goto('/search');
    await page
      .getByRole('button', {
        name: 'Add Ahri, Nine-Tailed Fox to collection',
        exact: true,
      })
      .first()
      .click();
    await expect(
      page
        .getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
        .filter({ hasText: 'Owned ×1' })
    ).toBeVisible();
    await page
      .getByRole('button', {
        name: 'Add Blade of the Ruined King to collection',
        exact: true,
      })
      .first()
      .click();
    const secondCard = page
      .getByRole('button', { name: 'Blade of the Ruined King', exact: true })
      .filter({ hasText: 'Owned ×1' });
    await expect(secondCard).toBeVisible();
    rejectFirst();
    await expect.poll(() => firstFailed).toBe(true);
    await expect(
      page
        .getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
        .filter({ hasText: 'Owned ×1' })
    ).toHaveCount(0);
    await expect(secondCard).toBeVisible({ timeout: 2000 });
  } finally {
    rejectFirst();
    releaseSecond();
  }
});

test('reopens filters and card details without blocking the catalog', async ({
  context,
  page,
}) => {
  await installMockApi(context);
  await page.goto('/search');
  for (let cycle = 0; cycle < 3; cycle++) {
    await selectFilter(page, 'Type', 'Legend');
    await expect(
      page
        .getByRole('button', { name: 'Blade of the Ruined King', exact: true })
        .first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
    ).toHaveCount(0);
    await selectFilter(page, 'Type', 'Legend');
    const card = page
      .getByRole('button', { name: 'Ahri, Nine-Tailed Fox', exact: true })
      .first();
    await expect(card).toBeVisible();
    await card.click();
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await expect(
        page.getByRole('button', { name: 'Close card detail', exact: true })
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Close card detail', exact: true })
        .click({ position: { x: 10, y: 10 } });
      await expect(
        page.getByRole('button', { name: 'Close card detail', exact: true })
      ).toHaveCount(0);
    }
  }
});
