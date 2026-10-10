import { expect, test } from '@playwright/test';
import { installMockApi, MOCK_API_ORIGIN, mockCard } from '../helpers/mock-api';

const headers = {
  'access-control-allow-origin': 'http://localhost:7011',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

for (const failFirst of [false, true]) {
  test(`keeps three rapid adds consistent after ${failFirst ? 'an earlier failure' : 'delayed responses'}`, async ({
    context,
    page,
  }) => {
    await installMockApi(context);
    const card = mockCard(0);
    let serverQuantity = 0;
    let requests = 0;
    let collectionReads = 0;
    let finished = 0;
    let releaseFirst!: () => void;
    let releaseRest!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const rest = new Promise<void>((resolve) => {
      releaseRest = resolve;
    });
    await context.route(`${MOCK_API_ORIGIN}/api/v1/collection`, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      collectionReads++;
      const data = serverQuantity
        ? [
            {
              id: '00000000-0000-4000-8000-000000000001',
              variantNumber: card.variantNumber,
              quantity: serverQuantity,
              condition: 'near_mint',
              language: 'en',
              isFoil: false,
              notes: null,
              isGraded: false,
              gradeCompany: null,
              gradeScore: null,
              acquiredAt: null,
              acquiredPriceCents: null,
              addedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              name: card.name,
              imageUrl: card.imageUrl,
              setCode: card.setCode,
              rarity: card.rarity,
              type: card.type,
              variantLabel: 'Standard',
            },
          ]
        : [];
      await route.fulfill({
        json: { data, meta: { total: data.length, totalQuantity: serverQuantity } },
        headers,
      });
    });
    await context.route(
      `${MOCK_API_ORIGIN}/api/v1/collection/quantities`,
      async (route) => {
        await route.fulfill({
          json: {
            data: [
              {
                variantNumber: card.variantNumber,
                quantity: serverQuantity,
                isFoil: false,
              },
            ],
          },
          headers,
        });
      }
    );
    await context.route(
      `${MOCK_API_ORIGIN}/api/v1/collection/OGN-001/add`,
      async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers });
          return;
        }
        const number = ++requests;
        await (number === 1 ? first : rest);
        if (number === 1 && failFirst) {
          await route.fulfill({
            status: 503,
            json: { error: 'temporarily unavailable' },
            headers,
          });
        } else {
          serverQuantity++;
          await route.fulfill({ json: { data: { ok: true } }, headers });
        }
        finished++;
      }
    );
    try {
      await page.goto('/search');
      const tile = page.getByRole('button', { name: card.name, exact: true }).first();
      await page
        .getByRole('button', { name: `Add ${card.name} to collection`, exact: true })
        .first()
        .click();
      await expect(tile).toContainText('Owned ×1', { timeout: 2000 });
      for (const quantity of [2, 3]) {
        await page
          .getByRole('button', { name: `Add one ${card.name}`, exact: true })
          .first()
          .click();
        await expect(tile).toContainText(`Owned ×${quantity}`, { timeout: 2000 });
      }
      await expect.poll(() => requests).toBe(3);
      expect(finished).toBe(0);
      releaseFirst();
      await expect.poll(() => finished).toBe(1);
      await expect(tile).toContainText(`Owned ×${failFirst ? 2 : 3}`, {
        timeout: 2000,
      });
      releaseRest();
      await expect.poll(() => finished).toBe(3);
      if (failFirst) await expect.poll(() => collectionReads).toBeGreaterThan(1);
      await expect(tile).toContainText(`Owned ×${failFirst ? 2 : 3}`);
      expect(serverQuantity).toBe(failFirst ? 2 : 3);
    } finally {
      releaseFirst();
      releaseRest();
    }
  });
}
