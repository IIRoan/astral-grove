import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CardDetailResponse,
  CardsListResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
} from '@riftbound/contracts';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';

setDefaultTimeout(120_000);

const testEmail = `test-search-flow-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';

function collectVariantNumbers(cards: CardsListResponse['data']): string[] {
  const variants = new Set<string>();
  for (const card of cards) {
    variants.add(card.variantNumber);
    for (const printing of card.printings ?? []) {
      variants.add(printing.variantNumber);
    }
  }
  return [...variants];
}

beforeAll(async () => {
  await cleanupTestUsers('test-search-flow-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'Search Flow User',
  });
});

afterAll(async () => {
  await cleanupTestUsers('test-search-flow-%');
});

describe('mobile search workflow', () => {
  test('search → quantities → detail mirrors the app data path', async () => {
    const searchRes = await authFetch(
      '/api/v1/cards?q=vi&limit=40&page=1&sortBy=name&dir=asc'
    );
    expect(searchRes.status).toBe(200);
    const search = CardsListResponse.parse(await searchRes.json());
    expect(search.data.length).toBeGreaterThan(0);
    expect(search.meta.source).toBe('cache');

    const variantNumbers = collectVariantNumbers(search.data).slice(0, 20);
    expect(variantNumbers.length).toBeGreaterThan(0);

    const quantitiesRes = await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumbers }),
    });
    expect(quantitiesRes.status).toBe(200);
    const quantities = CollectionQuantitiesResponse.parse(await quantitiesRes.json());
    expect(quantities.data).toHaveLength(variantNumbers.length);
    expect(quantities.data.every((row) => row.quantity >= 0)).toBe(true);

    const firstVariant = search.data[0]!.variantNumber;
    const detailRes = await authFetch(
      `/api/v1/cards/${encodeURIComponent(firstVariant)}`
    );
    expect(detailRes.status).toBe(200);
    const detail = CardDetailResponse.parse(await detailRes.json());
    expect(detail.data.variants.some((v) => v.variantNumber === firstVariant)).toBe(
      true
    );
  });

  test('adding a searched card updates quantities without listing the full collection', async () => {
    const searchRes = await authFetch('/api/v1/cards?q=blazing&limit=5&page=1');
    const search = CardsListResponse.parse(await searchRes.json());
    const target = search.data[0];
    expect(target?.variantNumber).toBeTruthy();

    const variantNumber = target!.variantNumber;

    const addRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
      {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(addRes.status).toBe(200);

    const quantitiesRes = await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumbers: [variantNumber] }),
    });
    const quantities = CollectionQuantitiesResponse.parse(await quantitiesRes.json());
    const owned = quantities.data.find((row) => row.variantNumber === variantNumber);
    expect(owned?.quantity).toBeGreaterThan(0);

    const listRes = await authFetch('/api/v1/collection', { cookie: cookieHeader });
    const list = CollectionListResponse.parse(await listRes.json());
    const fullEntry = list.data.find((item) => item.variantNumber === variantNumber);
    expect(fullEntry?.quantity).toBe(owned?.quantity);
  });

  test('catalog index contains searchable cards used by the mobile client', async () => {
    const indexRes = await authFetch('/api/v1/cards/index');
    expect(indexRes.status).toBe(200);
    const index = await indexRes.json();

    const searchRes = await authFetch('/api/v1/cards?q=vi&limit=10&page=1');
    const search = CardsListResponse.parse(await searchRes.json());
    const searchVariant = search.data[0]?.variantNumber;
    expect(searchVariant).toBeTruthy();

    const indexed = (index.data as Array<{ variantNumber: string }>).some(
      (card) => card.variantNumber === searchVariant
    );
    expect(indexed).toBe(true);
    expect(index.meta.total).toBeGreaterThan(100);
  });

  test('repeated search is served from cache with stable results', async () => {
    const path = '/api/v1/cards?q=jinx&limit=20&page=1&sortBy=name&dir=asc';

    const first = CardsListResponse.parse(await (await authFetch(path)).json());
    const second = CardsListResponse.parse(await (await authFetch(path)).json());

    expect(first.meta.source).toBe('cache');
    expect(second.meta.source).toBe('cache');
    expect(second.data.map((card) => card.variantNumber)).toEqual(
      first.data.map((card) => card.variantNumber)
    );
  });
});
