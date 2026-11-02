import { expect, test } from '@playwright/test';
import {
  cardDetail,
  corsHeaders,
  installMockApi,
  MOCK_API_ORIGIN,
  mockCard,
  mockDeck,
} from '../helpers/mock-api';

const lastCaress = {
  ...mockCard(0),
  name: 'Last Caress',
  type: 'Spell' as const,
  super: 'Signature',
  colors: ['Body', 'Chaos'],
};

const base = mockDeck(0);
const evelynnDeck = {
  ...base,
  legend: {
    ...base.legend,
    name: "Evelynn, Agony's Embrace",
    type: 'Legend',
    tags: ['Evelynn'],
    colors: ['Body', 'Chaos'],
  },
  mainDeck: [],
};

test('a Legend can add its own signature spell, and it saves with its tags', async ({
  context,
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1024,
    'Side-by-side builder is desktop'
  );
  await installMockApi(context);
  const mock = (url: string | RegExp, json: unknown) =>
    context.route(url, (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: corsHeaders() })
        : route.fulfill({ headers: corsHeaders(), json })
    );
  await mock(`${MOCK_API_ORIGIN}/api/v1/decks/deck-0**`, { data: evelynnDeck });
  await mock(/\/api\/v1\/decks(\?.*)?$/, {
    data: [evelynnDeck],
    meta: { total: 1, owned: 1, imported: 0 },
  });
  await mock(/\/api\/v1\/cards\?.*types=Unit/, {
    data: [lastCaress],
    meta: {
      pagination: { total: 1, page: 1, limit: 80, totalPages: 1, hasNext: false },
      source: 'cache',
      catalogHash: 'layout-hash',
    },
  });
  await mock(`${MOCK_API_ORIGIN}/api/v1/cards/batch`, {
    data: [{ ...cardDetail(lastCaress), tags: ['Evelynn'] }],
    meta: { found: 1, notFound: [], source: 'cache' },
  });

  await page.goto('/decks/deck-0?mode=edit');
  const save = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' && (request.postData() ?? '').includes('Last Caress')
  );
  await page
    .getByRole('button', { name: 'Add Last Caress to deck', exact: true })
    .click();

  expect((await save).postDataJSON().mainDeck[0].card.tags).toEqual(['Evelynn']);
});
