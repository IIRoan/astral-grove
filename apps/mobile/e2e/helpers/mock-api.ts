import type { BrowserContext, Route } from '@playwright/test';
import { API_URL_RUNTIME_OVERRIDE_KEY } from '../../lib/api-url';

/** Offline API origin for layout specs — every request is fulfilled in-browser, no backend or DB needed. */
export const MOCK_API_ORIGIN = 'http://mock-api.test';

const NOW = '2026-01-01T00:00:00.000Z';
const USER_ID = 'layout-user-0001';
const COLLECTION_ID = '00000000-0000-4000-8000-00000000c011';

// 1×1 transparent PNG.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const TYPES = ['Unit', 'Spell', 'Gear', 'Legend', 'Rune', 'Battlefield'] as const;
const DOMAINS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'] as const;

/** Deliberately long names stress truncation in tiles, list rows and headers. */
const NAMES = [
  'Ahri, Nine-Tailed Fox',
  'Sunlit Guardian of the Eternal Dawn Citadel',
  'Jinx',
  'Blade of the Ruined King',
  'Azir, Emperor of the Sands and Shurima Reborn',
  'Cleave',
];

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

function price(market: number) {
  return {
    currency: 'EUR' as const,
    low: market * 0.8,
    market,
    avg7d: market,
    isFoil: false,
  };
}

export function mockCard(i: number) {
  const variantNumber = `OGN-${String(i + 1).padStart(3, '0')}`;
  const type = TYPES[i % TYPES.length]!;
  return {
    cardId: uuid(i + 1),
    variantNumber,
    name: NAMES[i % NAMES.length]!,
    type,
    super: i % 5 === 0 ? 'Champion' : null,
    variantType: 'Normal',
    energy: i % 8,
    might: i % 6,
    power: i % 3,
    rarity: ['Common', 'Uncommon', 'Rare', 'Epic'][i % 4]!,
    setCode: 'OGN',
    colors: [
      DOMAINS[i % DOMAINS.length]!,
      ...(i % 3 === 0 ? [DOMAINS[(i + 1) % 6]!] : []),
    ],
    imageUrl: `${MOCK_API_ORIGIN}/img/${variantNumber}.png`,
    cardmarketId: null,
    priceEur: price(1234.56 + i),
    printings: [
      {
        variantNumber,
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: price(1234.56 + i),
      },
    ],
    isBanned: i === 1,
  };
}

const CARDS = Array.from({ length: 48 }, (_, i) => mockCard(i));

function cardDetail(card: ReturnType<typeof mockCard>) {
  return {
    id: card.cardId,
    name: card.name,
    type: card.type,
    super: card.super ?? null,
    description:
      '[ACCELERATE] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[ASSAULT 2] (+2 [Might] while I am an attacker.)\nWhen you play me, discard 2.',
    energy: card.energy,
    might: card.might,
    power: card.power,
    tags: ['Piltover', 'Zaun'],
    colors: card.colors.map((name, i) => ({ id: uuid(900 + i), name })),
    variants: [
      {
        id: uuid(500),
        variantNumber: card.variantNumber,
        rarity: card.rarity,
        variantType: 'Normal',
        variantLabel: 'Standard',
        foilMode: 'none',
        imageUrl: card.imageUrl,
        cardmarketId: null,
        tcgplayerId: null,
        releaseDate: '2025-10-31',
        artist: 'A Very Long Artist Name Studio Collective',
        prices: [price(12.5)],
      },
    ],
    banEffectiveDate: null,
  };
}

function filters() {
  const count = (names: readonly string[]) =>
    names.map((name, i) => ({ id: uuid(700 + i), name, count: 10 }));
  return {
    data: {
      colors: count(DOMAINS),
      sets: [
        { id: uuid(800), name: 'Origins', code: 'OGN', count: 48, printCount: 48 },
      ],
      types: count(TYPES),
      supertypes: count(['Champion', 'Signature', 'Token']),
      rarities: count(['Common', 'Uncommon', 'Rare', 'Epic']),
      variants: count(['Normal', 'Alternate Art', 'Overnumbered']),
    },
    meta: {
      cachedAt: NOW,
      catalogHash: 'layout-hash',
      pricesCatalogHash: 'layout-price-hash',
      variantCount: CARDS.length,
    },
  };
}

function deckCard(card: ReturnType<typeof mockCard>) {
  return {
    cardId: card.cardId,
    variantNumber: card.variantNumber,
    name: card.name,
    type: card.type,
    super: card.super ?? null,
    tags: ['Piltover'],
    colors: card.colors,
    energy: card.energy,
    power: card.power,
    setCode: card.setCode,
    rarity: card.rarity,
    variantType: 'Normal',
    isSignature: false,
    imageUrl: card.imageUrl,
  };
}

function deck(i: number) {
  const legend = deckCard(CARDS[3]!);
  return {
    id: `deck-${i}`,
    name:
      i === 0
        ? 'An Extremely Long Deck Name That Should Truncate Cleanly'
        : `Deck ${i}`,
    description: 'Midrange list.',
    format: 'constructed',
    createdAt: 1_735_689_600_000,
    updatedAt: 1_735_689_600_000,
    legend,
    champion: null,
    mainDeck: CARDS.slice(0, 12).map((c) => ({ card: deckCard(c), count: 3 })),
    runes: [],
    battlefields: [],
    sideboard: [],
    source: 'owned',
    readOnly: false,
    versions: [
      { id: `v-${i}`, name: 'Current', createdAt: 1, updatedAt: 1, isActive: true },
    ],
  };
}

type Json = unknown;

function resolve(method: string, path: string, url: URL): Json | undefined {
  if (path === '/api/auth/get-session') {
    return {
      session: {
        id: 'layout-session',
        userId: USER_ID,
        token: 'layout-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: NOW,
        updatedAt: NOW,
      },
      user: {
        id: USER_ID,
        name: 'Layout Tester With A Rather Long Display Name',
        email: 'layout-tester-with-a-long-address@example.test',
        emailVerified: true,
        image: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    };
  }
  if (path.startsWith('/api/auth/')) return { ok: true };
  if (path === '/api/v1/health') return { status: 'ok' };
  if (path === '/api/v1/filters') return filters();
  if (path === '/api/v1/cards/index') {
    return {
      data: CARDS,
      meta: {
        catalogHash: 'layout-hash',
        pricesCatalogHash: 'layout-price-hash',
        total: CARDS.length,
        source: 'cache',
      },
    };
  }
  if (path === '/api/v1/cards/batch') {
    return {
      data: CARDS.slice(0, 12).map(cardDetail),
      meta: { found: 12, notFound: [], source: 'cache' },
    };
  }
  if (path.startsWith('/api/v1/cards/')) {
    const vn = decodeURIComponent(path.split('/').pop() ?? '');
    const card = CARDS.find((c) => c.variantNumber === vn) ?? CARDS[0]!;
    return { data: cardDetail(card), meta: { source: 'cache', contentHash: 'h' } };
  }
  if (path === '/api/v1/cards' || path === '/api/v1/search') {
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const page = Number(url.searchParams.get('page') ?? 1);
    const data = CARDS.slice((page - 1) * limit, page * limit);
    return {
      data,
      meta: {
        pagination: {
          total: CARDS.length,
          page,
          limit,
          totalPages: Math.ceil(CARDS.length / limit),
          hasNext: page * limit < CARDS.length,
        },
        source: 'cache',
        catalogHash: 'layout-hash',
      },
    };
  }
  if (
    path === '/api/v1/collection/share' ||
    path.startsWith('/api/v1/collection/share/status')
  ) {
    return {
      data: {
        shared: false,
        memberCount: 1,
        collectionId: COLLECTION_ID,
        role: 'owner',
        partner: null,
        pendingInvite: null,
      },
    };
  }
  if (path.startsWith('/api/v1/collection/quantities')) return { data: [] };
  if (path.startsWith('/api/v1/collection/recent-adds')) return { data: [] };
  if (path.startsWith('/api/v1/collection')) {
    return method === 'GET'
      ? { data: [], meta: { total: 0, totalQuantity: 0 } }
      : { data: { ok: true } };
  }
  if (path.startsWith('/api/v1/wishlist')) {
    return method === 'GET' ? { data: [], meta: { total: 0 } } : { data: { ok: true } };
  }
  if (path.startsWith('/api/v1/decks/')) {
    return { data: deck(0) };
  }
  if (path === '/api/v1/decks') {
    const data = Array.from({ length: 8 }, (_, i) => deck(i));
    return { data, meta: { total: data.length, owned: data.length, imported: 0 } };
  }
  if (path.startsWith('/api/v1/settings')) {
    return {
      data: {
        device: 'phone',
        settings: { theme: 'dark', defaultLayout: 'grid', gridCardSize: 'large' },
        updatedAt: null,
      },
    };
  }
  if (path.startsWith('/api/v1/prices')) {
    return { data: [], meta: {} };
  }
  return undefined;
}

export type MockApi = { unhandled: string[] };

/** Point the app at the mock origin and fulfill every API + image request offline. */
export async function installMockApi(context: BrowserContext): Promise<MockApi> {
  const state: MockApi = { unhandled: [] };

  await context.addInitScript(
    ({ key, apiUrl }) => {
      Object.defineProperty(globalThis, key, {
        value: apiUrl,
        configurable: true,
        enumerable: false,
        writable: true,
      });
    },
    { key: API_URL_RUNTIME_OVERRIDE_KEY, apiUrl: MOCK_API_ORIGIN }
  );

  await context.route(`${MOCK_API_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/api/v1/images')) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: PNG_1PX,
        headers: corsHeaders(),
      });
      return;
    }
    const body = resolve(request.method(), url.pathname, url);
    if (body === undefined) {
      state.unhandled.push(`${request.method()} ${url.pathname}`);
    }
    await route.fulfill({
      status: body === undefined ? 404 : 200,
      contentType: 'application/json',
      headers: corsHeaders(),
      body: JSON.stringify(body ?? { error: 'not mocked' }),
    });
  });

  // Never let layout specs reach the hosted API or third-party hosts.
  await context.route(
    /^https?:\/\/(?!localhost|127\.0\.0\.1|mock-api\.test)/,
    (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX })
  );

  return state;
}

function corsHeaders() {
  return {
    'access-control-allow-origin': 'http://localhost:7011',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };
}
