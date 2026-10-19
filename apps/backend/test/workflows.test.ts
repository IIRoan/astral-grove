import { afterAll, beforeAll, expect, test, setDefaultTimeout } from 'bun:test';
import sharp from 'sharp';
import { S3Client } from 'bun';
import { startStorageFixture, validS3Signature } from './s3-fixture';
import {
  SyncCatalogResponse,
  SyncPricesResponse,
  SyncStatusResponse,
  CollectionQuantitiesResponse,
  CollectionItemResponse,
  PaLogicalCard,
} from '@riftbound/contracts';
import { createHarness, json, runCommand, waitFor } from './support';
const { startServer, stopServer, signup, sql } = createHarness();
import { seedOfflineCatalog, startOfflineUpstream } from './fixtures/offline';
import { releaseAccessToken } from '../../../scripts/lib/internal-release-signing';
setDefaultTimeout(180000);
let app: Awaited<ReturnType<typeof startServer>>;
const upstream = startOfflineUpstream();
const storage = startStorageFixture();
const { objects } = storage;
let source: Uint8Array;
const cdn = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch(request) {
    return new URL(request.url).pathname.endsWith('invalid.png')
      ? new Response('invalid', { headers: { 'content-type': 'image/png' } })
      : new Response(new Uint8Array(source).buffer, {
          headers: { 'content-type': 'image/png' },
        });
  },
});
beforeAll(async () => {
  source = new Uint8Array(
    await sharp({
      create: { width: 256, height: 128, channels: 4, background: '#123456' },
    })
      .png()
      .toBuffer()
  );
  app = await startServer({
    PA_BASE_URL: upstream.url,
    CARDMARKET_EXPORT_BASE_URL: upstream.url,
    IMAGE_CDN_BASE_URL: cdn.url.origin,
    SYNC_MAX_PAGES: '1',
    S3_ENDPOINT: storage.origin,
    S3_BUCKET: 'workflow-fixture',
    S3_ACCESS_KEY_ID: 'fixture-access',
    S3_SECRET_ACCESS_KEY: 'fixture-secret',
  });
  await seedOfflineCatalog(sql);
});
afterAll(async () => {
  upstream.stop();
  storage.stop();
  cdn.stop(true);
  await stopServer();
});
test('catalog sync publishes partial progress and remains retryable', async () => {
  const response = await app.fetch('/api/v1/sync/catalog?force=true', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN },
  });
  expect(response.status).toBe(200);
  const result = SyncCatalogResponse.parse(await response.json());
  expect(result.data.pages).toBe(1);
  expect(result.data.changed).toBe(true);
  expect(result.data.hash).toMatch(/^[a-f0-9]{64}$/);
  const status = SyncStatusResponse.parse(
    await (
      await app.fetch('/api/v1/sync/status', {
        headers: { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN },
      })
    ).json()
  );
  expect(status.data.catalog.status).toBe('idle');
});

test('card audit detects stale fields, stays read-only by default and verifies explicit repairs', async () => {
  const row = (
    await sql`SELECT c.id,c.name,c.content_hash AS hash,v.variant_number AS number FROM cards c JOIN variants v ON v.card_id=c.id ORDER BY v.variant_number LIMIT 1`
  )[0]!;
  try {
    await sql`UPDATE cards SET name='Synthetic stale audit name',content_hash='stale-audit' WHERE id=${row.id}`;
    const check = await runCommand(app.config, [
      'audit:cards',
      '--variant',
      row.number,
      '--json',
    ]);
    expect(check.exitCode).toBe(1);
    const report = JSON.parse(check.output);
    expect(report.checked).toBe(1);
    expect(report.mismatches).toHaveLength(1);
    expect(
      report.mismatches[0].diffs.some((diff: { path: string }) => diff.path === 'name')
    ).toBe(true);
    expect((await sql`SELECT name FROM cards WHERE id=${row.id}`)[0]!.name).toBe(
      'Synthetic stale audit name'
    );
    const repair = await runCommand(app.config, [
      'audit:cards',
      '--variant=' + row.number,
      '--fix',
      '--json',
    ]);
    expect(repair.exitCode).toBe(0);
    const fixed = JSON.parse(repair.output);
    expect(fixed.fixed).toBe(1);
    expect(fixed.postFixMismatches).toBe(0);
    expect((await sql`SELECT name FROM cards WHERE id=${row.id}`)[0]!.name).toBe(
      row.name
    );
  } finally {
    await sql`UPDATE cards SET name=${row.name},content_hash=${row.hash} WHERE id=${row.id}`;
  }
});

test('maintenance selection, retention dry run and database-only search explain work without PA', async () => {
  const config = { ...app.config, PA_BASE_URL: 'http://127.0.0.1:1' };
  const before = (await sql`SELECT count(*)::integer AS count FROM price_history`)[0]!
    .count;
  const missing = await runCommand(config, ['prune:prices', '--target=test']);
  expect(missing.exitCode).toBe(1);
  expect(missing.errors).toContain('no default database');
  const prune = await runCommand(config, [
    'prune:prices',
    '--target=test',
    '--use-env=TEST_DB_URL',
    '--retain-days=91',
  ]);
  expect(prune.exitCode).toBe(0);
  expect(JSON.parse(prune.output).dryRun).toBe(true);
  expect(
    (await sql`SELECT count(*)::integer AS count FROM price_history`)[0]!.count
  ).toBe(before);
  const explain = await runCommand(config, [
    'explain:search',
    '--target=test',
    '--use-env=TEST_DB_URL',
    '--with-local-service',
    '--repeat=2',
  ]);
  if (explain.exitCode !== 0) throw new Error(explain.errors);
  const report = JSON.parse(explain.output);
  expect(report.cases).toHaveLength(33);
  expect(report.service).toHaveLength(33);
  expect(report.catalog.postgresVersion).toContain('PostgreSQL 16');
  expect(report.cases.every((value: { planJson: unknown }) => value.planJson)).toBe(
    true
  );
  expect(explain.output).not.toContain('fixture-secret');
});
test('price sync persists current and daily prices and skips unchanged exports', async () => {
  const sync = () =>
    app.fetch('/api/v1/sync/prices', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN },
    });
  const response = await sync();
  expect(response.status).toBe(200);
  const result = SyncPricesResponse.parse(await response.json());
  expect(result.data.rowCount).toBeGreaterThan(1000);
  expect((await sql`SELECT count(*)::integer AS count FROM prices`)[0]!.count).toBe(
    result.data.rowCount
  );
  const next = await sync();
  expect(next.status).toBe(200);
  expect(SyncPricesResponse.parse(await next.json()).data.changed).toBe(false);
});
test('image derivatives persist to S3, validate decoding and use conditional HTTP caching', async () => {
  const response = await app.fetch('/api/v1/images/cards/workflow.png?w=%2B96');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/webp');
  const image = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  expect(image.width).toBe(96);
  expect(image.height).toBe(48);
  await waitFor(
    () =>
      objects.has('/workflow-fixture/cards/workflow.png') &&
      objects.has('/workflow-fixture/thumbs/w96/cards/workflow.png')
  );
  const cached = await app.fetch('/api/v1/images/cards/workflow.png?w=96', {
    headers: { 'if-none-match': response.headers.get('etag')! },
  });
  expect(cached.status).toBe(304);
  expect(cached.headers.get('x-image-source')).toBe('memory');
  expect((await app.fetch('/api/v1/images/cards/invalid.png?w=96')).status).toBe(500);
});
test('signed release downloads preserve GET, HEAD, MIME and private-cache behavior', async () => {
  for (const filename of ['preview.html', 'preview.plist', 'preview.apk']) {
    const key = 'releases/' + filename;
    objects.set('/workflow-fixture/' + key, {
      body: new TextEncoder().encode('synthetic release content'),
      type: 'application/octet-stream',
    });
    const token = releaseAccessToken('fixture-secret', key);
    const path = '/api/v1/releases/' + filename + '?token=' + token;
    const response = await app.fetch(path, { redirect: 'manual' });
    expect(response.status).toBe(filename.endsWith('.apk') ? 302 : 200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    if (filename.endsWith('.apk')) {
      expect(response.headers.get('location')).toContain('X-Amz-Signature');
      const location = response.headers.get('location')!;
      expect(location).toContain('us-east-1');
      const download = await fetch(location);
      expect(download.status).toBe(200);
      expect(download.headers.get('content-type')).toBe(
        'application/vnd.android.package-archive'
      );
      expect(download.headers.get('content-disposition')).toBe(
        'attachment; filename="astral-grove-preview.apk"'
      );
      expect(await download.text()).toBe('synthetic release content');
    } else expect(await response.text()).toBe('synthetic release content');
    const head = await app.fetch(path, { method: 'HEAD', redirect: 'manual' });
    expect(head.status).toBe(response.status);
    expect(await head.text()).toBe('');
    if (filename.endsWith('.apk')) {
      const location = new URL(head.headers.get('location')!);
      expect(location.searchParams.get('response-content-type')).toBe(
        'application/vnd.android.package-archive'
      );
      expect(location.searchParams.get('response-content-disposition')).toBe(
        'attachment; filename="astral-grove-preview.apk"'
      );
      const download = await fetch(location, { method: 'HEAD' });
      expect(download.status).toBe(200);
      expect(await download.text()).toBe('');
    }
    expect(
      (await app.fetch('/api/v1/releases/' + filename + '?token=invalid')).status
    ).toBe(404);
  }
});

test('the independent S3 verifier accepts Bun signatures and rejects tampering', async () => {
  const client = new S3Client({
    endpoint: storage.origin,
    bucket: 'workflow-fixture',
    accessKeyId: 'fixture-access',
    secretAccessKey: 'fixture-secret',
    region: 'us-east-1',
  });
  const url = client.presign('releases/preview.apk', { method: 'GET', expiresIn: 60 });
  expect(validS3Signature(new Request(url), 'fixture-secret')).toBe(true);
  expect(validS3Signature(new Request(url, { method: 'HEAD' }), 'fixture-secret')).toBe(
    false
  );
  expect(validS3Signature(new Request(url), 'wrong-secret')).toBe(false);
});

test('default request bodies and public errors remain usable through HTTP and Expo web CORS', async () => {
  const user = await signup(app, 'boundary');
  const headers = { 'content-type': 'application/json', cookie: user.cookie };
  for (const path of [
    '/api/v1/collection/OGN-001/add',
    '/api/v1/collection/OGN-001/remove',
  ]) {
    expect((await app.fetch(path, { method: 'POST', headers })).status).toBe(200);
  }
  expect(
    (await app.fetch('/api/v1/settings/phone', { method: 'PUT', headers })).status
  ).toBe(200);
  const malformed = await app.fetch('/api/v1/collection/OGN-001', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({
    error: 'VALIDATION_ERROR',
    message: 'Invalid JSON request body',
  });
  const invalid = await app.fetch('/api/v1/collection/OGN-001', {
    method: 'PUT',
    headers,
    body: '{"quantity":null}',
  });
  expect(invalid.status).toBe(422);
  expect(await invalid.json()).toEqual({
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
  });
  const preflight = await app.fetch('/api/v1/decks/example/versions/example', {
    method: 'OPTIONS',
    headers: { 'access-control-request-method': 'PATCH' },
  });
  expect(preflight.status).toBe(204);
  expect(
    preflight.headers
      .get('access-control-allow-methods')
      ?.split(',')
      .map((value) => value.trim())
  ).toContain('PATCH');
});

test('quantity lookups retain both finishes, sum stacks and deduplicate requested variants', async () => {
  const current = (await signup(app, 'quantities')).cookie;
  for (const body of [
    { delta: 2, isFoil: false },
    { delta: 3, isFoil: true },
    { delta: 4, isFoil: true, condition: 'mint' },
  ])
    expect(
      (await app.fetch('/api/v1/collection/OGN-001/add', json(body, current))).status
    ).toBe(200);
  const response = await app.fetch(
    '/api/v1/collection/quantities',
    json({ variantNumbers: ['OGN-001', 'OGN-001', 'NOT-OWNED'] }, current)
  );
  expect(response.status).toBe(200);
  expect(CollectionQuantitiesResponse.parse(await response.json()).data).toEqual([
    { variantNumber: 'OGN-001', isFoil: false, quantity: 2 },
    { variantNumber: 'OGN-001', isFoil: true, quantity: 7 },
    { variantNumber: 'NOT-OWNED', isFoil: false, quantity: 0 },
  ]);
});

test('stored acquisition and legality timestamps preserve JavaScript millisecond semantics', async () => {
  const user = await signup(app, 'date');
  const current = user.cookie;
  for (const acquiredAt of [
    '2026-01-01T00:00:00.123999999999Z',
    '1969-12-31T23:59:59.999999999999Z',
    '0001-01-01T12:00:00.99999999Z',
    '9999-12-31T23:59:59.99999999Z',
  ]) {
    const response = await app.fetch('/api/v1/collection/OGN-001', {
      ...json({ quantity: 1, acquiredAt }, current),
      method: 'PUT',
    });
    expect(response.status).toBe(200);
    const expected = new Date(acquiredAt).toISOString();
    expect(CollectionItemResponse.parse(await response.json()).data.acquiredAt).toBe(
      expected
    );
    const rows =
      await sql`SELECT to_char(i.acquired_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS value FROM collection_items i JOIN collection_members m ON m.collection_id=i.collection_id WHERE m.user_id=${user.user.id} AND i.variant_number='OGN-001'`;
    expect(rows[0]!.value).toBe(expected.replace('Z', '000Z'));
  }
  const original = (
    await sql`SELECT c.id,c.content_hash AS hash,c.upstream_raw AS raw,to_char(c.ban_effective_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ban,v.variant_number AS number FROM cards c JOIN variants v ON v.card_id=c.id ORDER BY v.variant_number LIMIT 1`
  )[0]!;
  const logical = PaLogicalCard.parse(original.raw);
  let remote = logical;
  const pa = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => Response.json(remote),
  });
  try {
    for (const date of [
      '2026-01-01T00:00:00.123999999999Z',
      '1969-12-31T23:59:59.999999999999Z',
      '0001-01-01T00:00:00.99999999Z',
      '9999-12-31T23:59:59.99999999Z',
    ]) {
      remote = { ...logical, banEffectiveDate: date };
      const result = await runCommand({ ...app.config, PA_BASE_URL: pa.url.origin }, [
        'audit:cards',
        '--variant=' + original.number,
        '--fix',
        '--json',
      ]);
      if (result.exitCode !== 0) throw new Error(result.errors);
      const stored = (
        await sql`SELECT to_char(ban_effective_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS value FROM cards WHERE id=${original.id}`
      )[0]!;
      expect(stored.value).toBe(new Date(date).toISOString().replace('Z', '000Z'));
    }
  } finally {
    pa.stop(true);
    await sql.unsafe(
      'UPDATE cards SET upstream_raw=$2::text::json,content_hash=$3,ban_effective_date=$4::timestamptz WHERE id=$1::uuid',
      [original.id, JSON.stringify(original.raw), original.hash, original.ban]
    );
  }
});
