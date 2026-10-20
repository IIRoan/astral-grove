import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import { cookie, createHarness, json, password, waitFor } from './support';
import { startJmapFixture } from './fixtures/jmap';
import { startOfflineUpstream } from './fixtures/offline';
import { DeckDetailResponse, DeckListResponse } from '@riftbound/contracts';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { startStorageFixture } from './s3-fixture';
import { releaseAccessToken } from '../../../scripts/lib/internal-release-signing';

setDefaultTimeout(60000);
const harness = createHarness();
const { sql } = harness;
let app: Awaited<ReturnType<typeof harness.startServer>>;
const addresses: string[] = [];
beforeAll(async () => {
  app = await harness.startServer();
});
afterAll(async () => {
  for (const address of addresses) {
    await sql`DELETE FROM verification WHERE identifier LIKE ${`%${address}%`}`;
  }
  await harness.stopServer();
});
async function signup(label: string) {
  const user = await harness.signup(app, `security-${label}`);
  addresses.push(user.email);
  return user;
}

test('unused OTP login and recovery cannot issue, check or consume codes', async () => {
  const user = await signup('disabled');
  for (const type of ['sign-in', 'forget-password']) {
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${`${type}-otp-${user.email}`},'123456:0',now()+interval '5 minutes')`;
    for (const path of ['send-verification-otp', 'check-verification-otp']) {
      const result = await app.fetch(
        `/api/auth/email-otp/${path}`,
        json({ email: user.email, type, otp: '123456' })
      );
      expect(result.status).toBe(400);
    }
  }
  for (const path of [
    '/sign-in/email-otp',
    '/email-otp/request-password-reset',
    '/forget-password/email-otp',
    '/email-otp/reset-password',
  ]) {
    const result = await app.fetch(
      `/api/auth${path}`,
      json({ email: user.email, otp: '123456', password: 'replacement-password-123' })
    );
    expect(result.status).toBe(404);
    expect(result.headers.get('set-cookie')).toBeNull();
  }
  expect(
    (await app.fetch('/api/auth/sign-in/email', json({ email: user.email, password })))
      .status
  ).toBe(200);
});

test('verification never logs another account in or replaces a current session', async () => {
  const a = await signup('verify-a'),
    b = await signup('verify-b');
  await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${`email-verification-otp-${a.email}`},'123456:0',now()+interval '5 minutes')`;
  const response = await app.fetch(
    '/api/auth/email-otp/verify-email',
    json({ email: a.email, otp: '123456' }, b.cookie)
  );
  expect(response.status).toBe(403);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(
    (
      await (
        await app.fetch('/api/auth/get-session', { headers: { cookie: b.cookie } })
      ).json()
    ).user.id
  ).toBe(b.user.id);
  const verified = await app.fetch(
    '/api/auth/email-otp/verify-email',
    json({ email: a.email, otp: '123456' })
  );
  expect(verified.status).toBe(200);
  expect((await verified.json()).token).toBeNull();
  expect(verified.headers.get('set-cookie')).toBeNull();
});

test('account attempt budgets survive a replacement OTP and process restart', async () => {
  const user = await signup('attempts');
  const identifier = `email-verification-otp-${user.email}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    await sql`DELETE FROM verification WHERE identifier=${identifier}`;
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${identifier},'123456:0',now()+interval '5 minutes')`;
    expect(
      (
        await app.fetch(
          '/api/auth/email-otp/check-verification-otp',
          json({ email: user.email, type: 'email-verification', otp: '000000' })
        )
      ).status
    ).toBe(400);
  }
  const other = await harness.startServer();
  expect(
    (
      await other.fetch(
        '/api/auth/email-otp/verify-email',
        json({ email: user.email, otp: '123456' })
      )
    ).status
  ).toBe(429);
});

test('password reset wins over a login that already verified the old password', async () => {
  const user = await signup('reset-race');
  const token = `security-${crypto.randomUUID()}`;
  await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${`reset-password:${token}`},${user.user.id},now()+interval '5 minutes')`;
  const lock = await holdCredentialLock(user.user.id);
  const reset = app.fetch(
    '/api/auth/reset-password',
    json({ token, newPassword: 'new-secure-password-123' })
  );
  let login: Promise<Response> | undefined;
  try {
    await waitFor(async () => (await lock.waiting()) >= 1);
    login = app.fetch('/api/auth/sign-in/email', json({ email: user.email, password }));
    await waitFor(async () => (await lock.waiting()) >= 2);
    await lock.release();
    expect((await reset).status).toBe(200);
    expect((await login).status).toBe(401);
    expect(
      await sql`SELECT id FROM session WHERE user_id=${user.user.id}`
    ).toHaveLength(0);
  } finally {
    await lock.release();
    await reset;
    await login;
  }
});

test('auth profile inputs are bounded before persistence', async () => {
  const user = await signup('profile');
  for (const body of [
    { name: 'x'.repeat(257) },
    { image: 'https://example.invalid/' + 'x'.repeat(2049) },
  ]) {
    expect(
      (await app.fetch('/api/auth/update-user', json(body, user.cookie))).status
    ).toBe(400);
  }
});

test('resending verification is account limited and cannot clear failed guesses', async () => {
  const mail = startJmapFixture();
  try {
    const server = await harness.startServer({
      STALWART_JMAP_URL: mail.url,
      STALWART_JMAP_USERNAME: 'fixture',
      STALWART_JMAP_PASSWORD: 'fixture',
      EMAIL_FROM: 'noreply@test.riftbound.dev',
    });
    const user = await harness.signup(server, 'resend');
    addresses.push(user.email);
    const identifier = `email-verification-otp-${user.email}`;
    const old = (
      await sql`SELECT value FROM verification WHERE identifier=${identifier}`
    )[0]!.value;
    const wrong = old.startsWith('000000:') ? '111111' : '000000';
    expect(
      (
        await server.fetch(
          '/api/auth/email-otp/check-verification-otp',
          json({ email: user.email, type: 'email-verification', otp: wrong })
        )
      ).status
    ).toBe(400);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await server.fetch(
            '/api/auth/email-otp/send-verification-otp',
            json({ email: user.email, type: 'email-verification' })
          )
        ).status
      ).toBe(200);
    expect(
      (
        await server.fetch(
          '/api/auth/email-otp/send-verification-otp',
          json({ email: user.email, type: 'email-verification' })
        )
      ).status
    ).toBe(429);
    expect(mail.messages).toHaveLength(3);
    expect(
      (
        await sql`SELECT value FROM verification WHERE identifier=${`otp-attempts:${identifier}`}`
      )[0]!.value
    ).toBe('1');
    expect(
      (
        await server.fetch(
          '/api/auth/request-password-reset',
          json({ email: user.email, redirectTo: 'astral-grove://reset-password' })
        )
      ).status
    ).toBe(403);
    const callback = await server.fetch(
      '/api/auth/reset-password/test?callbackURL=astral-grove%3A%2F%2Freset-password',
      { redirect: 'manual' }
    );
    expect(callback.status).toBe(403);
    expect(mail.messages).toHaveLength(3);
  } finally {
    mail.stop();
  }
});

test('spoofed IP headers cannot reset auth limits; explicitly trusted proxy chains work', async () => {
  const direct = await harness.startServer({ NODE_ENV: 'development' });
  const proxy = await harness.startServer({
    NODE_ENV: 'development',
    TRUSTED_PROXY_CIDRS: '127.0.0.1/32',
  });
  for (const server of [direct, proxy]) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await server.fetch('/api/auth/sign-in/email', {
        ...json({ email: 'missing@test.riftbound.dev', password }),
        headers: {
          'content-type': 'application/json',
          'x-real-ip': `198.51.100.${attempt + 1}`,
          'x-forwarded-for': `198.51.100.${attempt + 1}, 192.0.2.1`,
        },
      });
      expect(response.status).toBe(attempt < 3 ? 401 : 429);
    }
  }
  expect(
    (
      await proxy.fetch('/api/auth/sign-in/email', {
        ...json({ email: 'missing@test.riftbound.dev', password }),
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.2' },
      })
    ).status
  ).toBe(401);
  for (let index = 0; index < 101; index++) {
    const response = await direct.fetch(
      `/api/auth/reset-password/${index}?callbackURL=${encodeURIComponent(direct.config.PUBLIC_APP_URL + '/reset-password')}`,
      { redirect: 'manual' }
    );
    expect(response.status).toBe(index < 100 ? 302 : 429);
  }
});

test('cookie mutations require an allowed browser origin or the native request header', async () => {
  const user = await signup('csrf');
  const path = '/api/v1/collection/OGN-001/add';
  for (const headers of [
    { cookie: user.cookie, origin: 'https://sibling.solace.onl' },
    { cookie: user.cookie, 'sec-fetch-site': 'same-site' },
    { cookie: user.cookie, 'x-astral-request': '1', 'sec-fetch-site': 'same-site' },
  ]) {
    const response = await fetch(app.origin + path, { method: 'POST', headers });
    expect(response.status).toBe(403);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  }
  expect(
    (
      await fetch(app.origin + path, {
        method: 'POST',
        headers: { cookie: user.cookie, 'x-astral-request': '1' },
      })
    ).status
  ).toBe(200);
  expect(
    (await app.fetch(path, { method: 'POST', headers: { cookie: user.cookie } })).status
  ).toBe(200);
  expect(
    (
      await fetch(app.origin + path, {
        method: 'POST',
        headers: { authorization: `Bearer ${user.token}` },
      })
    ).status
  ).toBe(200);
  expect(
    (
      await app.fetch(path, {
        method: 'POST',
        headers: { cookie: user.cookie, 'content-type': 'text/plain' },
        body: '{}',
      })
    ).status
  ).toBe(415);
  const preflight = await app.fetch(path, {
    method: 'OPTIONS',
    headers: {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'x-astral-request,content-type',
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get('access-control-allow-headers')).toContain(
    'X-Astral-Request'
  );
});

test('existing native JSON requests work without weakening browser or form protections', async () => {
  const user = await signup('native-compatibility');
  const path = '/api/v1/collection/OGN-001/add';
  for (const type of ['application/json', 'application/json; charset=utf-8']) {
    expect(
      (
        await fetch(app.origin + path, {
          method: 'POST',
          headers: { cookie: user.cookie, 'content-type': type },
          body: '{}',
        })
      ).status
    ).toBe(200);
  }
  for (const type of [
    '',
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=example',
    'application/jsonp',
    'application/json, text/plain',
  ]) {
    expect(
      (
        await fetch(app.origin + path, {
          method: 'POST',
          headers: { cookie: user.cookie, ...(type ? { 'content-type': type } : {}) },
          body: '{}',
        })
      ).status
    ).toBe(403);
  }
  for (const browserHeaders of [
    { origin: 'https://sibling.solace.onl' },
    { origin: 'null' },
    { 'sec-fetch-site': 'same-site' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    expect(
      (
        await fetch(app.origin + path, {
          method: 'POST',
          headers: {
            cookie: user.cookie,
            'content-type': 'application/json',
            ...browserHeaders,
          },
          body: '{}',
        })
      ).status
    ).toBe(403);
  }
});

test('auth and ordinary API requests reject oversized bodies before parsing', async () => {
  for (const [path, size] of [
    ['/api/auth/sign-in/email', 65537],
    ['/api/v1/cards/batch', 2 * 1024 * 1024 + 1],
  ] as const) {
    const response = await app.fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: ' '.repeat(size),
    });
    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toContain('application/json');
  }
  expect((await app.fetch('/api/v1/health')).status).toBe(200);
  expect(
    (await app.fetch('/api/v1/collection/import', { method: 'POST', body: '{' })).status
  ).toBe(401);
});

test('slow request bodies are bounded while health and auth stay available and permits recover', async () => {
  const requests = Array.from({ length: 65 }, () => {
    const complete = Promise.withResolvers<number>();
    const request = httpRequest(
      app.origin + '/api/v1/cards/batch',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: app.origin },
      },
      (response) => {
        response.resume();
        response.on('end', () => complete.resolve(response.statusCode ?? 0));
      }
    );
    request.on('error', complete.reject);
    request.flushHeaders();
    request.write('{');
    return { request, complete };
  });
  try {
    expect(await Promise.race(requests.map(({ complete }) => complete.promise))).toBe(
      503
    );
    expect((await app.fetch('/api/v1/health')).status).toBe(200);
    expect(
      (
        await app.fetch(
          '/api/auth/sign-in/email',
          json({ email: 'slow-body@test.riftbound.dev', password })
        )
      ).status
    ).toBe(401);
  } finally {
    for (const { request } of requests) request.end('"variantNumbers":["OGN-001"]}');
    expect(
      (await Promise.all(requests.map(({ complete }) => complete.promise))).sort()
    ).toEqual([...Array(64).fill(200), 503]);
  }
  expect(
    (await app.fetch('/api/v1/cards/batch', json({ variantNumbers: ['OGN-001'] })))
      .status
  ).toBe(200);
});

test('auth and API body read deadlines release stalled requests', async () => {
  const requests = ['/api/auth/sign-in/email', '/api/v1/cards/batch'].map((path) => {
    const complete = Promise.withResolvers<number>();
    const request = httpRequest(
      app.origin + path,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: app.origin },
      },
      (response) => {
        response.resume();
        response.on('end', () => complete.resolve(response.statusCode ?? 0));
      }
    );
    request.on('error', complete.reject);
    request.flushHeaders();
    request.write('{');
    return { request, complete };
  });
  try {
    expect((await app.fetch('/api/v1/health')).status).toBe(200);
    expect(await Promise.all(requests.map(({ complete }) => complete.promise))).toEqual(
      [408, 408]
    );
  } finally {
    for (const { request } of requests) request.destroy();
  }
  expect(
    (await app.fetch('/api/v1/cards/batch', json({ variantNumbers: ['OGN-001'] })))
      .status
  ).toBe(200);
}, 15000);

test('encoded image traversal never reaches the CDN', async () => {
  let calls = 0;
  const cdn = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      if (request.method === 'GET') calls++;
      return new Response(null, { status: 404 });
    },
  });
  try {
    const server = await harness.startServer({ IMAGE_CDN_BASE_URL: cdn.url.origin });
    for (const key of [
      'cards/.%252e/private.png',
      'cards/%252e%252e/private.png',
      'cards/a%3Fb.png',
      'cards/a%23b.png',
      'cards/a%5Cb.png',
    ]) {
      expect((await server.fetch('/api/v1/images/' + key)).status).toBe(404);
    }
    expect(calls).toBe(0);
    expect(
      (
        await server.fetch('/api/v1/images/cards/valid-card.png', {
          redirect: 'manual',
        })
      ).status
    ).toBe(302);
    expect(calls).toBe(1);
  } finally {
    cdn.stop(true);
  }
});

test('anonymous empty searches are cached and distinct queries share an upstream budget', async () => {
  let calls = 0;
  const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      if (request.method === 'GET') calls++;
      return Response.json({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      });
    },
  });
  try {
    const server = await harness.startServer({
      PA_BASE_URL: upstream.url.origin,
      UPSTREAM_REQUESTS_PER_MINUTE: '8',
    });
    for (let i = 0; i < 3; i++)
      expect((await server.fetch('/api/v1/cards?q=security-no-such-card')).status).toBe(
        200
      );
    expect(calls).toBe(1);
    for (const query of ['another-empty-query', 'yet-another-empty-query'])
      expect((await server.fetch('/api/v1/cards?q=' + query)).status).toBe(200);
    expect(calls).toBe(2);
  } finally {
    upstream.stop(true);
  }
});

test('CSV rejects invalid stack fields while valid rows remain editable and removable', async () => {
  const user = await signup('csv');
  const header =
    'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes';
  const row = (language: string, notes = '') =>
    [
      'OGN-001',
      '',
      '',
      '',
      '',
      '',
      '',
      'false',
      '1',
      language,
      'Near Mint',
      '',
      '',
      '',
      notes,
    ].join(',');
  const csv = [
    header,
    row('a'.repeat(17)),
    row('en', 'x'.repeat(2001)),
    row('en', 'Valid note'),
  ].join('\n');
  const response = await app.fetch(
    '/api/v1/collection/import',
    json({ csv }, user.cookie)
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data).toMatchObject({
    imported: 1,
    failedRows: 2,
    totalCopies: 1,
  });
  const body = { quantity: 3, language: 'en', condition: 'near_mint', isFoil: false };
  expect(
    (
      await app.fetch('/api/v1/collection/OGN-001', {
        ...json(body, user.cookie),
        method: 'PUT',
      })
    ).status
  ).toBe(200);
  expect(
    (
      await app.fetch(
        '/api/v1/collection/OGN-001?language=en&condition=near_mint&isFoil=false',
        { method: 'DELETE', headers: { cookie: user.cookie } }
      )
    ).status
  ).toBe(200);
  const items = Array.from({ length: 1100 }, () => ({
    variantNumber: 'OGN-001',
    quantity: 1,
    notes: 'x'.repeat(2000),
  }));
  expect(JSON.stringify({ items }).length).toBeGreaterThan(2 * 1024 * 1024);
  const large = await app.fetch(
    '/api/v1/collection/import',
    json({ items }, user.cookie)
  );
  expect(large.status).toBe(200);
  expect((await large.json()).data).toMatchObject({
    imported: 1,
    failedRows: 0,
    totalCopies: 1100,
  });
});

test('former collection members keep historical attribution without exposing their current profile', async () => {
  const owner = await signup('history-owner'),
    member = await signup('history-member');
  const invite = await (
    await app.fetch('/api/v1/collection/share/invite', json({}, owner.cookie))
  ).json();
  expect(
    (
      await app.fetch(
        `/api/v1/collection/share/invite/${invite.data.token}/accept`,
        json({ mode: 'use_theirs' }, member.cookie)
      )
    ).status
  ).toBe(200);
  expect(
    (await app.fetch('/api/v1/collection/OGN-001/add', json({}, member.cookie))).status
  ).toBe(200);
  const history = async (path: string) => {
    const response = await app.fetch(
      '/api/v1/collection/' + path,
      path === 'audit'
        ? { headers: { cookie: owner.cookie } }
        : json({ variantNumbers: ['OGN-001'] }, owner.cookie)
    );
    expect(response.status).toBe(200);
    return (await response.json()).data as {
      actor: { userId: string; name: string | null; email: string | null };
    }[];
  };
  expect(
    (await history('activity-history')).find(
      (row) => row.actor.userId === member.user.id
    )?.actor.email
  ).toBe(member.email);
  expect(
    (await app.fetch('/api/v1/collection/share/leave', json({}, member.cookie))).status
  ).toBe(200);
  expect(
    (
      await app.fetch(
        '/api/auth/update-user',
        json({ name: 'Private new profile' }, member.cookie)
      )
    ).status
  ).toBe(200);
  for (const path of ['audit', 'activity-history', 'recent-adds']) {
    const rows = (await history(path)).filter(
      (row) => row.actor.userId === member.user.id
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows)
      expect(row.actor).toEqual({ userId: member.user.id, name: null, email: null });
  }
});

test('owned decks remain local; legacy shared-key decks cannot be read or changed through PA', async () => {
  const offline = startOfflineUpstream();
  const writes: string[] = [];
  const proxy = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      if (!['GET', 'HEAD'].includes(request.method))
        writes.push(request.method + ' ' + new URL(request.url).pathname);
      return fetch(offline.url + new URL(request.url).pathname, {
        method: request.method,
      });
    },
  });
  const source = 'migration-fixture-community-deck';
  try {
    const server = await harness.startServer({ PA_BASE_URL: proxy.url.origin });
    const owner = await harness.signup(server, 'deck-owner'),
      other = await harness.signup(server, 'deck-other');
    addresses.push(owner.email, other.email);
    const imported = await server.fetch(
      `/api/v1/decks/${source}/import`,
      json({}, owner.cookie)
    );
    expect(imported.status).toBe(200);
    const deck = DeckDetailResponse.parse(await imported.json()).data;
    const list = () =>
      server.fetch('/api/v1/decks?source=imported', {
        headers: { cookie: other.cookie },
      });
    expect(
      DeckListResponse.parse(await (await list()).json()).data.some(
        (item) => item.id === source
      )
    ).toBe(true);
    expect(
      (
        await server.fetch(`/api/v1/decks/${deck.id}`, {
          ...json({ ...deck, name: 'Local private edit' }, owner.cookie),
          method: 'PUT',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await server.fetch(
          `/api/v1/decks/${deck.id}/versions`,
          json({ name: 'Another version' }, owner.cookie)
        )
      ).status
    ).toBe(200);
    expect(writes).toEqual([]);
    await sql`UPDATE user_decks SET payload=payload-'importedFromId' WHERE user_id=${owner.user.id} AND id=${deck.id}`;
    for (const action of ['read', 'import']) {
      const result = await server.fetch(
        `/api/v1/decks/${source}${action === 'import' ? '/import' : ''}`,
        action === 'import'
          ? json({}, other.cookie)
          : { headers: { cookie: other.cookie } }
      );
      expect(result.status).toBe(404);
    }
    expect(
      DeckListResponse.parse(await (await list()).json()).data.some(
        (item) => item.id === source
      )
    ).toBe(false);
    expect(
      (
        await server.fetch(`/api/v1/decks/${deck.id}`, {
          ...json({ ...deck, name: 'Legacy local edit' }, owner.cookie),
          method: 'PUT',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await server.fetch(`/api/v1/decks/${deck.id}`, {
          method: 'DELETE',
          headers: { cookie: owner.cookie },
        })
      ).status
    ).toBe(200);
    expect(
      (
        await server.fetch(`/api/v1/decks/${source}`, {
          headers: { cookie: other.cookie },
        })
      ).status
    ).toBe(404);
    expect(writes).toEqual([]);
  } finally {
    await sql`DELETE FROM private_upstream_decks WHERE upstream_id=${source}`;
    proxy.stop(true);
    offline.stop();
  }
});

test('forward migration quarantines legacy mirrors and preserves imported community decks', async () => {
  const migration = await readFile(
    new URL('../migrations/0016_private_upstream_decks.sql', import.meta.url),
    'utf8'
  );
  const rollback = new Error('Rollback isolated migration fixture');
  try {
    await sql.begin(async (tx) => {
      const schema = 'security_' + crypto.randomUUID().replaceAll('-', '');
      await tx.unsafe(`CREATE SCHEMA ${schema}`);
      await tx.unsafe(`SET LOCAL search_path TO ${schema}`);
      await tx`CREATE TABLE user_decks(payload jsonb NOT NULL)`;
      for (const payload of [
        { upstreamId: 'legacy' },
        { upstreamId: 'legacy' },
        { upstreamId: 'copied', importedFromId: 'copied' },
        { id: 'local' },
        { upstreamId: '' },
      ]) {
        await tx`INSERT INTO user_decks(payload) VALUES(${tx.json(payload)})`;
      }
      await tx.unsafe(migration);
      expect([...(await tx`SELECT upstream_id FROM private_upstream_decks`)]).toEqual([
        { upstream_id: 'legacy' },
      ]);
      expect((await tx`SELECT count(*)::int AS n FROM user_decks`)[0]!.n).toBe(5);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  expect(
    await sql`SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at=1792400000000`
  ).toHaveLength(1);
});

test('separate release storage and link keys retain explicit legacy links without using image storage', async () => {
  const storage = startStorageFixture();
  const key = 'releases/preview.html';
  storage.objects.set('/release-fixture/' + key, {
    body: new TextEncoder().encode('<h1>Install</h1>'),
    type: 'text/html',
  });
  try {
    const config = {
      RELEASE_S3_ENDPOINT: storage.origin,
      RELEASE_S3_BUCKET: 'release-fixture',
      RELEASE_S3_ACCESS_KEY_ID: 'fixture-access',
      RELEASE_S3_SECRET_ACCESS_KEY: 'fixture-secret',
      RELEASE_LINK_SECRET: 'synthetic-link-key',
      RELEASE_LINK_LEGACY_SECRET: 'previous-link-key',
    };
    const server = await harness.startServer(config);
    const request = (secret: string) =>
      server.fetch('/api/v1/' + key + '?token=' + releaseAccessToken(secret, key));
    for (const secret of ['synthetic-link-key', 'previous-link-key']) {
      const response = await request(secret);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<h1>Install</h1>');
      expect(response.headers.get('content-security-policy')).toContain(
        "default-src 'none'"
      );
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    }
    expect((await request('fixture-secret')).status).toBe(404);
    expect((await request('incorrect-key')).status).toBe(404);
  } finally {
    storage.stop();
  }
});

function mailServer(mail: ReturnType<typeof startJmapFixture>) {
  return harness.startServer({
    STALWART_JMAP_URL: mail.url,
    STALWART_JMAP_USERNAME: 'fixture',
    STALWART_JMAP_PASSWORD: 'fixture',
    EMAIL_FROM: 'noreply@test.riftbound.dev',
  });
}
function lastMail(mail: ReturnType<typeof startJmapFixture>) {
  const message = mail.messages.at(-1) as { bodyValues: { text: { value: string } } };
  return message.bodyValues.text.value;
}
async function holdCredentialLock(userId: string) {
  const locked = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let pid = 0;
  const holder = sql.begin(async (tx) => {
    const rows =
      await tx`SELECT pg_backend_pid() AS pid,pg_advisory_xact_lock(hashtextextended(${`credential:${userId}`},1280472990))`;
    pid = rows[0]!.pid;
    locked.resolve();
    await release.promise;
  });
  await locked.promise;
  const waiting = async () =>
    Number(
      (
        await sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`
      )[0]!.n
    );
  return {
    waiting,
    release: async () => {
      release.resolve();
      await holder;
    },
  };
}

test('a password change verified before a reset cannot override it', async () => {
  const user = await signup('change-race');
  const token = `security-${crypto.randomUUID()}`;
  await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${`reset-password:${token}`},${user.user.id},now()+interval '5 minutes')`;
  const lock = await holdCredentialLock(user.user.id);
  let reset: Promise<Response> | undefined, change: Promise<Response> | undefined;
  try {
    reset = app.fetch(
      '/api/auth/reset-password',
      json({ token, newPassword: 'reset-wins-password-123' })
    );
    await waitFor(async () => (await lock.waiting()) >= 1);
    change = app.fetch(
      '/api/auth/change-password',
      json(
        {
          currentPassword: password,
          newPassword: 'stale-change-password-123',
          revokeOtherSessions: true,
        },
        user.cookie
      )
    );
    await waitFor(async () => (await lock.waiting()) >= 2);
    await lock.release();
    expect((await reset).status).toBe(200);
    const changed = await change;
    expect(changed.status).toBe(400);
    expect(changed.headers.get('set-cookie')).toBeNull();
    expect(
      await sql`SELECT id FROM session WHERE user_id=${user.user.id}`
    ).toHaveLength(0);
    for (const [candidate, status] of [
      ['stale-change-password-123', 401],
      ['reset-wins-password-123', 200],
    ] as const)
      expect(
        (
          await app.fetch(
            '/api/auth/sign-in/email',
            json({ email: user.email, password: candidate })
          )
        ).status
      ).toBe(status);
  } finally {
    await lock.release();
    await reset;
    await change;
  }
});

test('emailed verification links survive guess exhaustion and later resends', async () => {
  const mail = startJmapFixture();
  try {
    const server = await mailServer(mail);
    const user = await harness.signup(server, 'link');
    addresses.push(user.email);
    const link = new URL(lastMail(mail).match(/Or open this link: (\S+)/)![1]!);
    expect(link.searchParams.get('otp')).toBeNull();
    const token = link.searchParams.get('token')!;
    expect(token).toHaveLength(43);
    const guess = () =>
      server.fetch(
        '/api/auth/email-otp/check-verification-otp',
        json({ email: user.email, type: 'email-verification', otp: '000000' })
      );
    for (let attempt = 0; attempt < 10; attempt++)
      expect((await guess()).status).toBe(400);
    expect((await guess()).status).toBe(429);
    expect(
      (
        await server.fetch(
          '/api/auth/email-otp/send-verification-otp',
          json({ email: user.email, type: 'email-verification' })
        )
      ).status
    ).toBe(200);
    const code = lastMail(mail).match(/Verification code: (\d{6})/)![1];
    const verify = (otp: string | undefined) =>
      server.fetch(
        '/api/auth/email-otp/verify-email',
        json({ email: user.email, otp })
      );
    expect((await verify(code)).status).toBe(429);
    const verified = await verify(token);
    expect(verified.status).toBe(200);
    expect((await verified.json()).user.emailVerified).toBe(true);
    expect(verified.headers.get('set-cookie')).toBeNull();
    expect((await verify(token)).status).toBe(400);
  } finally {
    mail.stop();
  }
});

test('unknown addresses meet the same issuance and guessing limits as accounts', async () => {
  const mail = startJmapFixture();
  try {
    const server = await mailServer(mail);
    const unknown = `security-unknown-${crypto.randomUUID()}@test.riftbound.dev`;
    addresses.push(unknown);
    const send = () =>
      server.fetch(
        '/api/auth/email-otp/send-verification-otp',
        json({ email: unknown, type: 'email-verification' })
      );
    for (let attempt = 0; attempt < 3; attempt++)
      expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await server.fetch(
        '/api/auth/email-otp/check-verification-otp',
        json({ email: unknown, type: 'email-verification', otp: '000000' })
      );
      expect(response.status).toBe(attempt < 10 ? 400 : 429);
    }
    expect(mail.messages).toHaveLength(0);
    const user = await harness.signup(server, 'quiet-resend');
    addresses.push(user.email);
    for (let attempt = 0; attempt < 4; attempt++)
      expect(
        (
          await server.fetch(
            '/api/auth/send-verification-email',
            json({ email: user.email })
          )
        ).status
      ).toBe(200);
    expect(mail.messages).toHaveLength(3);
  } finally {
    mail.stop();
  }
});

test('email change guesses share a target budget and void old reset links', async () => {
  const mail = startJmapFixture();
  try {
    const server = await mailServer(mail);
    const a = await harness.signup(server, 'change-a'),
      b = await harness.signup(server, 'change-b');
    addresses.push(a.email, b.email);
    await sql`UPDATE "user" SET email_verified=true WHERE id IN (${a.user.id},${b.user.id})`;
    const signIn = async (email: string) =>
      cookie(await server.fetch('/api/auth/sign-in/email', json({ email, password })));
    const ca = await signIn(a.email),
      cb = await signIn(b.email);
    const target = `security-target-${crypto.randomUUID()}@test.riftbound.dev`;
    addresses.push(target);
    for (const session of [ca, cb])
      expect(
        (
          await server.fetch(
            '/api/auth/email-otp/request-email-change',
            json({ newEmail: target }, session)
          )
        ).status
      ).toBe(200);
    const change = (session: string, otp: string) =>
      server.fetch(
        '/api/auth/email-otp/change-email',
        json({ newEmail: target, otp }, session)
      );
    for (let attempt = 0; attempt < 10; attempt++)
      expect((await change(ca, '000000')).status).toBe(400);
    expect((await change(cb, '000000')).status).toBe(429);
    await sql`DELETE FROM verification WHERE identifier=${`otp-attempts:target:change-email:${target}`}`;
    const reset = `security-${crypto.randomUUID()}`;
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${`reset-password:${reset}`},${b.user.id},now()+interval '1 hour')`;
    const code = (
      await sql`SELECT value FROM verification WHERE identifier=${`change-email-otp-${b.email}-${target}`}`
    )[0]!.value.split(':')[0];
    expect((await change(cb, code)).status).toBe(200);
    expect(
      await sql`SELECT id FROM verification WHERE identifier=${`reset-password:${reset}`}`
    ).toHaveLength(0);
    expect(
      (
        await server.fetch(
          '/api/auth/reset-password',
          json({ token: reset, newPassword: 'mailbox-takeover-123' })
        )
      ).status
    ).toBe(400);
  } finally {
    mail.stop();
  }
});

test('failed sign-ins are budgeted per address across client identities', async () => {
  const user = await signup('account-budget');
  for (let attempt = 0; attempt < 20; attempt++)
    expect(
      (
        await app.fetch(
          '/api/auth/sign-in/email',
          json({ email: user.email, password: 'incorrect-password-123' })
        )
      ).status
    ).toBe(401);
  const response = await app.fetch(
    '/api/auth/sign-in/email',
    json({ email: user.email, password })
  );
  expect(response.status).toBe(429);
  expect(response.headers.get('set-cookie')).toBeNull();
});

test('release links signed with the storage key are rejected without a link secret', async () => {
  const storage = startStorageFixture();
  const key = 'releases/preview.html';
  storage.objects.set('/image-fixture/' + key, {
    body: new TextEncoder().encode('<h1>Install</h1>'),
    type: 'text/html',
  });
  try {
    const server = await harness.startServer({
      S3_ENDPOINT: storage.origin,
      S3_BUCKET: 'image-fixture',
      S3_ACCESS_KEY_ID: 'fixture-access',
      S3_SECRET_ACCESS_KEY: 'fixture-secret',
    });
    expect(
      (
        await server.fetch(
          '/api/v1/' + key + '?token=' + releaseAccessToken('fixture-secret', key)
        )
      ).status
    ).toBe(404);
  } finally {
    storage.stop();
  }
});

test('service-authored PA decks stay hidden even without a local mapping', async () => {
  const offline = startOfflineUpstream();
  try {
    const server = await harness.startServer({
      PA_BASE_URL: offline.url,
      UPSTREAM_SERVICE_AUTHOR: 'Fixture author',
    });
    const user = await harness.signup(server, 'service-author');
    addresses.push(user.email);
    const source = 'migration-fixture-community-deck';
    expect(
      (
        await server.fetch(`/api/v1/decks/${source}`, {
          headers: { cookie: user.cookie },
        })
      ).status
    ).toBe(404);
    expect(
      (await server.fetch(`/api/v1/decks/${source}/import`, json({}, user.cookie)))
        .status
    ).toBe(404);
    expect(
      DeckListResponse.parse(
        await (
          await server.fetch('/api/v1/decks?source=imported', {
            headers: { cookie: user.cookie },
          })
        ).json()
      ).data.some((item) => item.id === source)
    ).toBe(false);
  } finally {
    offline.stop();
  }
});

test('legacy deck ids and version history are quarantined by a forward migration', async () => {
  const migration = await readFile(
    new URL('../migrations/0017_private_legacy_deck_ids.sql', import.meta.url),
    'utf8'
  );
  const rollback = new Error('Rollback isolated migration fixture');
  try {
    await sql.begin(async (tx) => {
      const schema = 'security_' + crypto.randomUUID().replaceAll('-', '');
      await tx.unsafe(`CREATE SCHEMA ${schema}`);
      await tx.unsafe(`SET LOCAL search_path TO ${schema}`);
      await tx`CREATE TABLE private_upstream_decks(upstream_id text PRIMARY KEY)`;
      await tx`CREATE TABLE user_decks(id text NOT NULL, payload jsonb NOT NULL)`;
      await tx`CREATE TABLE user_deck_versions(payload jsonb NOT NULL)`;
      for (const [id, payload] of [
        ['pa-legacy-id', {}],
        ['pa-imported-id', { importedFromId: 'pa-imported-id' }],
        ['deck_local', {}],
      ] as const)
        await tx`INSERT INTO user_decks(id,payload) VALUES(${id},${tx.json(payload)})`;
      for (const payload of [
        { upstreamId: 'old-version-mirror' },
        { upstreamId: 'copied', importedFromId: 'copied' },
        { upstreamId: '' },
      ])
        await tx`INSERT INTO user_deck_versions(payload) VALUES(${tx.json(payload)})`;
      await tx.unsafe(migration);
      expect(
        [...(await tx`SELECT upstream_id FROM private_upstream_decks ORDER BY 1`)].map(
          (row) => row.upstream_id
        )
      ).toEqual(['old-version-mirror', 'pa-legacy-id']);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  expect(
    await sql`SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at=1792400100000`
  ).toHaveLength(1);
});
