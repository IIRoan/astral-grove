import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { DeckDetailResponse, DeckListResponse } from '@riftbound/contracts';
import { eq, like } from 'drizzle-orm';
import { getEnv, getContext, getBaseUrl } from './support.js';
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
} from '../../src/db/auth-schema.js';
import { userDecks } from '../../src/db/schema.js';

setDefaultTimeout(180_000);

let cookieHeader = '';
const testEmail = `test-decks-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
const testName = 'Decks Test User';

function extractCookies(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) return setCookies.map((c) => c.split(';')[0]).join('; ');
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,\s*(?=[^;]+?=)/)
    .map((c) => c.split(';')[0])
    .join('; ');
}

async function authFetch(
  path: string,
  init?: RequestInit & { cookie?: string }
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set('cookie', init.cookie);
  if (init?.body && !headers.has('content-type'))
    headers.set('content-type', 'application/json');
  return fetch(`${getBaseUrl()}${path}`, { ...init, headers });
}

async function cleanupTestUsers(): Promise<void> {
  try {
    const { db } = getContext();
    const testUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(like(userTable.email, 'test-decks-%'));
    for (const u of testUsers) {
      await db.delete(userDecks).where(eq(userDecks.userId, u.id));
      await db.delete(sessionTable).where(eq(sessionTable.userId, u.id));
      await db.delete(accountTable).where(eq(accountTable.userId, u.id));
      await db.delete(userTable).where(eq(userTable.id, u.id));
    }
  } catch {}
}

function asAnyDeckId(x: unknown): string {
  if (typeof x === 'string' && x.length > 0) return x;
  throw new Error('Upstream deck id not found');
}

describe('decks: upstream transformation', () => {
  beforeAll(async () => {
    await cleanupTestUsers();

    const res = await authFetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });
    expect(res.status).toBeLessThan(400);
    cookieHeader = extractCookies(res);
    expect(cookieHeader).toBeTruthy();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  test('GET /api/v1/decks/:id returns transformed upstream deck payload', async () => {
    const env = getEnv();
    const upstream = await fetch(`${env.PA_BASE_URL}/v1/decks?limit=1`, {
      headers: { 'x-api-key': env.PA_API_KEY },
    });
    expect(upstream.status).toBe(200);
    const upstreamJson = (await upstream.json()) as unknown as {
      data: Array<{ id: unknown }>;
    };
    const deckId = asAnyDeckId(upstreamJson.data[0]?.id);

    const res = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      cookie: cookieHeader,
    });
    expect(res.status).toBe(200);
    const body = DeckDetailResponse.parse(await res.json());
    const deck = body.data;

    expect(deck.id).toBe(deckId);
    expect(deck.source).toBe('imported');
    expect(deck.readOnly).toBe(true);
    expect(deck.legend).not.toBeNull();
    expect(deck.legend?.variantNumber).toBeTruthy();
    expect(deck.champion).not.toBeNull();
    expect(deck.champion?.variantNumber).toBeTruthy();
    expect(deck.mainDeck.length).toBeGreaterThan(0);
    expect(deck.runes.length).toBeGreaterThanOrEqual(0);
  });

  test('imported upstream decks cannot be modified or deleted', async () => {
    const env = getEnv();
    const upstream = await fetch(`${env.PA_BASE_URL}/v1/decks?limit=1`, {
      headers: { 'x-api-key': env.PA_API_KEY },
    });
    expect(upstream.status).toBe(200);
    const upstreamJson = (await upstream.json()) as unknown as {
      data: Array<{ id: unknown }>;
    };
    const deckId = asAnyDeckId(upstreamJson.data[0]?.id);

    const getRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      cookie: cookieHeader,
    });
    expect(getRes.status).toBe(200);
    const existing = DeckDetailResponse.parse(await getRes.json()).data;

    const putRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({ ...existing, name: `${existing.name} (should fail)` }),
    });
    expect(putRes.status).toBe(403);

    const deleteRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'DELETE',
      cookie: cookieHeader,
    });
    expect(deleteRes.status).toBe(403);
  });

  test('GET /api/v1/decks returns imported summaries quickly', async () => {
    const start = performance.now();
    const res = await authFetch('/api/v1/decks?source=imported', {
      cookie: cookieHeader,
    });
    const elapsedMs = performance.now() - start;

    expect(res.status).toBe(200);
    expect(elapsedMs).toBeLessThan(15_000);

    const body = DeckListResponse.parse(await res.json());
    expect(body.meta.imported).toBeGreaterThanOrEqual(1);
    expect(body.data.every((deck) => deck.source === 'imported' && deck.readOnly)).toBe(
      true
    );
  });

  test('POST /api/v1/decks/:id/import copies an upstream deck into owned decks', async () => {
    const env = getEnv();
    const upstream = await fetch(`${env.PA_BASE_URL}/v1/decks?limit=1`, {
      headers: { 'x-api-key': env.PA_API_KEY },
    });
    expect(upstream.status).toBe(200);
    const upstreamJson = (await upstream.json()) as unknown as {
      data: Array<{ id: unknown }>;
    };
    const deckId = asAnyDeckId(upstreamJson.data[0]?.id);

    const importRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/import`,
      {
        method: 'POST',
        cookie: cookieHeader,
      }
    );
    expect(importRes.status).toBe(200);
    const imported = DeckDetailResponse.parse(await importRes.json()).data;
    expect(imported.source).toBe('owned');
    expect(imported.readOnly).toBe(false);
    expect(imported.id).not.toBe(deckId);
    expect(imported.upstreamId).toBe(deckId);

    const listRes = await authFetch('/api/v1/decks?source=owned', {
      cookie: cookieHeader,
    });
    expect(listRes.status).toBe(200);
    const owned = DeckListResponse.parse(await listRes.json()).data;
    expect(owned.some((deck) => deck.id === imported.id)).toBe(true);
  });

  test('PUT /api/v1/decks/:id stores owned deck locally when upstream write fails', async () => {
    const now = Date.now();
    const deckId = `deck_e2e_${now}`;

    const putRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        id: deckId,
        name: 'E2E Owned Deck',
        description: '',
        createdAt: now,
        updatedAt: now,
        legend: null,
        champion: null,
        mainDeck: [],
        runes: [],
        battlefields: [],
        sideboard: [],
      }),
    });
    expect(putRes.status).toBe(200);
    const putBody = DeckDetailResponse.parse(await putRes.json());
    expect(putBody.data.name).toBe('E2E Owned Deck');
    expect(putBody.data.source).toBe('owned');
    expect(putBody.data.readOnly).toBe(false);

    const sessionRes = await authFetch('/api/auth/get-session', {
      cookie: cookieHeader,
    });
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as { user?: { id?: string } | null };
    const userId = sessionBody.user?.id;
    expect(userId).toBeTruthy();

    const { db } = getContext();
    const row = await db.query.userDecks.findFirst({
      where: eq(userDecks.id, deckId),
    });
    expect(row).toBeTruthy();
  });
});
