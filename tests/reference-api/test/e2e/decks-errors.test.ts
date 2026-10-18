import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';

setDefaultTimeout(120_000);

const stamp = Date.now();
const password = 'test-password-12345';
let cookie = '';

beforeAll(async () => {
  await cleanupTestUsers('test-decks-err-%');
  cookie = await signUpTestUser({
    email: `test-decks-err-${stamp}@test.riftbound.dev`,
    password,
    name: 'Deck Errors User',
  });
});

afterAll(async () => {
  await cleanupTestUsers('test-decks-err-%');
});

function emptyDeckPayload(deckId: string, name: string) {
  const now = Date.now();
  return {
    id: deckId,
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    legend: null,
    champion: null,
    mainDeck: [],
    runes: [],
    battlefields: [],
    sideboard: [],
  };
}

describe('deck route error handling', () => {
  test('GET /decks/:id returns 404 for unknown owned deck', async () => {
    const res = await authFetch('/api/v1/decks/deck_does_not_exist_12345', { cookie });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Deck not found');
  });

  test('PUT /decks/:id uses path id even when body id differs', async () => {
    const deckId = `deck_mismatch_${stamp}`;
    const res = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify({
        ...emptyDeckPayload('different_id_in_body', 'Path Wins'),
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; name: string } };
    expect(body.data.id).toBe(deckId);
    expect(body.data.name).toBe('Path Wins');
  });

  test('DELETE /decks/:id returns 404 for unknown deck', async () => {
    const res = await authFetch('/api/v1/decks/deck_missing_delete_12345', {
      method: 'DELETE',
      cookie,
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Deck not found');
  });

  test('GET /decks returns 401 without session', async () => {
    const res = await authFetch('/api/v1/decks');
    expect(res.status).toBe(401);
  });

  test('GET /decks?source=owned filters to owned decks only', async () => {
    const deckId = `deck_owned_filter_${stamp}`;
    const putRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify(emptyDeckPayload(deckId, 'Owned Filter Deck')),
    });
    expect(putRes.status).toBe(200);

    const listRes = await authFetch('/api/v1/decks?source=owned&q=Owned%20Filter', {
      cookie,
    });
    expect(listRes.status).toBe(200);
    const body = (await listRes.json()) as {
      data: Array<{ id: string; source: string }>;
      meta: { owned: number; imported: number };
    };
    expect(body.data.some((deck) => deck.id === deckId)).toBe(true);
    expect(body.data.every((deck) => deck.source === 'owned')).toBe(true);
    expect(body.meta.imported).toBe(0);
  });
});
