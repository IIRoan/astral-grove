import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CollectionImportResponse,
  CollectionListResponse,
  parseCollectionCsv,
} from '@riftbound/contracts';
import { eq, like } from 'drizzle-orm';
import { getBaseUrl, apiFetch, getContext } from './support.js';
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
} from '../../src/db/auth-schema.js';

setDefaultTimeout(120_000);

let cookieHeader = '';
const testEmail = `test-collection-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';

function extractCookies(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    return setCookies.map((c) => c.split(';')[0]).join('; ');
  }
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
  if (init?.cookie) {
    headers.set('cookie', init.cookie);
  }
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(`${getBaseUrl()}${path}`, { ...init, headers });
}

async function cleanupTestUsers(): Promise<void> {
  try {
    const { db } = getContext();
    const testUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(like(userTable.email, 'test-collection-%'));
    for (const u of testUsers) {
      await db.delete(sessionTable).where(eq(sessionTable.userId, u.id));
      await db.delete(accountTable).where(eq(accountTable.userId, u.id));
      await db.delete(userTable).where(eq(userTable.id, u.id));
    }
  } catch {}
}

beforeAll(async () => {
  await cleanupTestUsers();

  const res = await authFetch('/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: 'Collection Test User',
    }),
  });
  expect(res.status).toBeLessThan(400);
  cookieHeader = extractCookies(res);
  expect(cookieHeader).toBeTruthy();
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe('collection import/export', () => {
  test('POST /api/v1/collection/import rejects unauthenticated requests', async () => {
    const res = await apiFetch('/api/v1/collection/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'Variant Number,Card Name\n' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/collection/export rejects unauthenticated requests', async () => {
    const res = await apiFetch('/api/v1/collection/export');
    expect(res.status).toBe(401);
  });

  test('imports a small CSV snippet and lists collection items', async () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,2,English,Near Mint,,,,',
      'OGN-002,Brazen Buccaneer,Origins,OGN,Common,Standard,Standard,false,1,English,Lightly Played,,,,',
    ].join('\n');

    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ csv }),
    });
    expect(importRes.status).toBe(200);
    const importBody = CollectionImportResponse.parse(await importRes.json());
    expect(importBody.data.imported).toBe(2);
    expect(importBody.data.errors).toEqual([]);

    const listRes = await authFetch('/api/v1/collection', { cookie: cookieHeader });
    expect(listRes.status).toBe(200);
    const listBody = CollectionListResponse.parse(await listRes.json());
    expect(listBody.meta.total).toBe(2);
    expect(listBody.meta.totalQuantity).toBe(3);

    const ogn001 = listBody.data.find((item) => item.variantNumber === 'OGN-001');
    expect(ogn001?.quantity).toBe(2);
    expect(ogn001?.condition).toBe('near_mint');
    expect(ogn001?.language).toBe('en');
  });

  test('exports collection as piltover CSV and round-trips labels', async () => {
    const exportRes = await authFetch('/api/v1/collection/export', {
      cookie: cookieHeader,
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain('text/csv');

    const csv = await exportRes.text();
    const { rows, errors } = parseCollectionCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const ogn001 = rows.find((row) => row['Variant Number'] === 'OGN-001');
    expect(ogn001?.['Card Name']).toBe('Blazing Scorcher');
    expect(ogn001?.Condition).toBe('Near Mint');
    expect(ogn001?.Language).toBe('English');
    expect(ogn001?.Quantity).toBe('2');
  });

  test('imports large CSV in chunked batches', async () => {
    const baseVariants = ['OGN-001', 'OGN-002', 'OGN-003', 'OGN-004'];
    const items = Array.from({ length: 150 }, (_, index) => ({
      variantNumber: baseVariants[index % baseVariants.length]!,
      quantity: 1,
      condition: 'near_mint' as const,
      language: `lang-${String(index)}`,
    }));

    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ items }),
    });
    expect(importRes.status).toBe(200);
    const importBody = CollectionImportResponse.parse(await importRes.json());
    expect(importBody.data.imported).toBe(150);
    expect(importBody.data.failedRows).toBe(0);
  });

  test('re-import updates quantities for matching entries', async () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,5,English,Near Mint,,,,',
    ].join('\n');

    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ csv }),
    });
    expect(importRes.status).toBe(200);

    const listRes = await authFetch('/api/v1/collection', { cookie: cookieHeader });
    const listBody = CollectionListResponse.parse(await listRes.json());
    const ogn001 = listBody.data.find((item) => item.variantNumber === 'OGN-001');
    expect(ogn001?.quantity).toBe(5);
  });

  test('reports unknown variants without failing entire import', async () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'ZZZ-999,Unknown Card,Unknown,ZZZ,Common,Standard,Standard,false,1,English,Near Mint,,,,',
      'OGN-003,Chemtech Enforcer,Origins,OGN,Common,Standard,Standard,false,1,English,Near Mint,,,,',
    ].join('\n');

    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ csv }),
    });
    expect(importRes.status).toBe(200);
    const importBody = CollectionImportResponse.parse(await importRes.json());
    expect(importBody.data.imported).toBe(1);
    expect(importBody.data.failedRows).toBeGreaterThanOrEqual(1);
  });

  test('aggregates duplicate CSV rows into total copy counts', async () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'OGN-004,Cleave,Origins,OGN,Common,Standard,Standard,false,2,English,Near Mint,,,,',
      'OGN-004,Cleave,Origins,OGN,Common,Standard,Standard,false,3,English,Near Mint,,,,',
    ].join('\n');

    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ csv }),
    });
    expect(importRes.status).toBe(200);
    const importBody = CollectionImportResponse.parse(await importRes.json());
    expect(importBody.data.imported).toBe(1);
    expect(importBody.data.totalCopies).toBe(5);
  });

  test('POST /api/v1/collection/quantities returns owned counts for requested variants', async () => {
    const res = await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({
        variantNumbers: ['OGN-001', 'OGN-999', 'OGN-003'],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(
      expect.arrayContaining([
        { variantNumber: 'OGN-001', isFoil: false, quantity: expect.any(Number) },
        { variantNumber: 'OGN-999', isFoil: false, quantity: 0 },
        { variantNumber: 'OGN-003', isFoil: false, quantity: expect.any(Number) },
      ])
    );
    expect(body.data).toHaveLength(3);
  });

  test('POST /api/v1/collection/quantities accepts more than 200 variants', async () => {
    const variantNumbers = Array.from({ length: 205 }, (_, index) => `OGN-${String(index + 1).padStart(3, '0')}`);
    const res = await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumbers }),
    });
    expect(res.status).toBe(200);
    const body = CollectionQuantitiesResponse.parse(await res.json());
    expect(body.data).toHaveLength(variantNumbers.length);
    expect(body.data.every((row) => row.quantity >= 0)).toBe(true);
  });

  test('DELETE /api/v1/collection/all clears the collection in non-production', async () => {
    const res = await authFetch('/api/v1/collection/all', {
      method: 'DELETE',
      cookie: cookieHeader,
    });
    expect(res.status).toBe(200);

    const listRes = await authFetch('/api/v1/collection', { cookie: cookieHeader });
    const listBody = CollectionListResponse.parse(await listRes.json());
    expect(listBody.meta.total).toBe(0);
  });
});
