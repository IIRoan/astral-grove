import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import {
  CardsListResponse,
  CollectionActivityHistoryResponse,
  CollectionRecentAddsResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
  HealthResponse,
  SyncCatalogResponse,
  SyncPricesResponse,
  SyncStatusResponse,
  RECENT_COLLECTION_ACTIVITY_LIMIT,
} from '@riftbound/contracts';
import { cpus, loadavg, release, totalmem } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import sharp from 'sharp';
import { createHarness, json, runCommand, waitFor } from '../support';
import { startFixtures } from './fixtures';
import { measure, percentiles, Resources } from './metrics';
import type { Sample } from './metrics';
import budgets from './budgets.json';

setDefaultTimeout(180000);
const samples = Number(process.env.ASTRAL_PERF_SAMPLES ?? budgets.samples);
const auditEvents = Math.max(10000, samples * 20 + 20);
const reportPath = process.env.ASTRAL_PERF_REPORT;
const binary = process.env.ASTRAL_BACKEND_BIN;
if (!reportPath || !binary)
  throw new Error('Run performance tests through bun run test:perf');
const plansPath = reportPath.replace(/\.json$/, '') + '-search-plans.json';
const harness = createHarness();
const results: Array<Awaited<ReturnType<typeof measure>> & { resources: unknown }> = [];
const observations: Record<string, unknown> = {};
const collections: string[] = [];
const runId = crypto.randomUUID();
let fixtures: Awaited<ReturnType<typeof startFixtures>>;
let app: Awaited<ReturnType<typeof harness.startServer>>;
let resources: Resources;
let initialResources: Awaited<ReturnType<Resources['snapshot']>>;
let user: { id: string; token: string; cookie: string };
let variants: string[];
let imageHash: string;
const startedAt = new Date().toISOString();
const loadAverageStart = loadavg();
const source = {
  head: new TextDecoder()
    .decode(Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { stderr: 'ignore' }).stdout)
    .trim(),
  trackedChanges: Bun.spawnSync(['git', 'diff', '--quiet']).exitCode !== 0,
};

async function readJson<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
  validate?: (value: T) => void
): Promise<Sample> {
  const start = performance.now();
  const response = await app.fetch(path, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  const bytes = await response.arrayBuffer();
  const ms = performance.now() - start;
  expect(response.status).toBe(200);
  const data = schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  validate?.(data);
  return { ms, status: response.status, bytes: bytes.byteLength };
}
async function bench(
  name: string,
  operation: (index: number) => Promise<Sample>,
  budgetMs: number,
  concurrency = 1,
  warmup = budgets.warmup,
  count = samples
) {
  const before = await resources.snapshot();
  const result = await measure(name, operation, {
    count,
    concurrency,
    warmup,
    budgetMs,
  });
  const after = await resources.snapshot();
  results.push({
    ...result,
    resources: {
      before,
      after,
      cpuMs: before && after ? after.cpuMs - before.cpuMs : null,
    },
  });
  console.log(
    `[performance] ${name}: p50=${result.latencyMs.p50.toFixed(2)}ms p95=${result.latencyMs.p95.toFixed(2)}ms p99=${result.latencyMs.p99.toFixed(2)}ms ${result.requestsPerSecond.toFixed(1)}req/s errors=${result.errors}`
  );
  expect(result.errors).toBe(0);
  expect(result.latencyMs.p95).toBeLessThanOrEqual(budgetMs);
  return result;
}
const credentials = () => ({ cookie: user.cookie });
const lookup = (variantNumbers: string[]) => json({ variantNumbers }, user.cookie);
function batch(size: number) {
  const owned = variants.slice(0, Math.min(size, variants.length));
  return [
    ...Array.from({ length: size - owned.length }, (_, index) => `UNOWNED-${index}`),
    ...owned,
  ];
}
beforeAll(async () => {
  fixtures = await startFixtures();
  imageHash = new Bun.CryptoHasher('sha256').update(fixtures.image).digest('hex');
  expect(fixtures.image.byteLength).toBeLessThan(5 * 1024 * 1024);
  app = await harness.startServer(fixtures.config);
  resources = new Resources(app.pid);
  resources.start();
  initialResources = await resources.snapshot();
  const signup = await harness.signup(app, 'performance');
  user = {
    id: signup.user.id,
    token: z.string().parse(signup.token),
    cookie: signup.cookie,
  };
  await readJson('/api/v1/collection', CollectionListResponse, {
    headers: credentials(),
  });
  const membership =
    await harness.sql`SELECT collection_id::text AS id FROM collection_members WHERE user_id=${user.id}`;
  const collection = z.string().parse(membership[0]?.id);
  collections.push(collection);
  variants = (
    await harness.sql`SELECT variant_number FROM variants ORDER BY variant_number LIMIT 500`
  ).map((item) => z.string().parse(item.variant_number));
  expect(variants.length).toBe(500);
  await harness.sql`INSERT INTO collection_items(collection_id,variant_number,quantity) SELECT ${collection}::uuid,variant_number,2 FROM variants ORDER BY variant_number LIMIT 500 ON CONFLICT DO NOTHING`;
  await harness.sql`WITH sample AS(SELECT variant_number,row_number() OVER(ORDER BY variant_number) AS rn FROM variants ORDER BY variant_number LIMIT 500)
    INSERT INTO collection_audit_events(collection_id,actor_user_id,action,variant_number,condition,language,is_foil,quantity_before,quantity_after,quantity_delta,created_at)
    SELECT ${collection}::uuid,${user.id},'add',s.variant_number,'near_mint','en',false,0,1,1,now()-g*interval '1 millisecond'
    FROM generate_series(1,${auditEvents}::integer) AS g JOIN sample s ON s.rn=(g-1)%500+1`;
  await harness.sql`ANALYZE collection_items,collection_audit_events,cards,variants,prices`;
  observations.fixture = {
    catalog:
      await harness.sql`SELECT (SELECT count(*)::integer FROM cards) AS cards,(SELECT count(*)::integer FROM variants) AS variants,(SELECT count(*)::integer FROM prices) AS prices`,
    collectionItems: 500,
    auditEvents,
    imageBytes: fixtures.image.byteLength,
    databasePool: 4,
    syncCatalogPages: 1,
  };
});
afterAll(async () => {
  fixtures?.release();
  resources?.stop();
  try {
    const finalResources = resources
      ? await resources.snapshot().catch(() => null)
      : null;
    const bytes = await Bun.file(binary).arrayBuffer();
    const report = {
      version: 1,
      startedAt,
      finishedAt: new Date().toISOString(),
      binary: {
        path: binary,
        mode: process.env.ASTRAL_PERF_BUILD,
        modifiedAt: new Date(Bun.file(binary).lastModified).toISOString(),
        sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
      },
      host: {
        platform: process.platform,
        arch: process.arch,
        release: release(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        totalMemoryBytes: totalmem(),
        loadAverageEnd: loadavg(),
        loadAverageStart,
      },
      budgets,
      samples,
      source,
      resources: { initial: initialResources, final: finalResources },
      observations,
      results,
      searchPlansPath: plansPath,
      notes: [
        'HTTP latency ends after reading the complete response body, before Zod validation. Throughput includes client validation and load-generator overhead.',
        'First request latency is reported separately where warmups are enabled. Database buffers are not flushed. p99 uses nearest rank over the reported sample count.',
        'All upstream, CDN and object-storage traffic targets local fixtures. Load generator, database and Rust server share this host.',
        'Linux RSS is sampled every 100ms and also records the kernel RSS high-water mark; CPU and PSS are process snapshots. Resource metrics are null on other operating systems.',
        'Expected sync overload responses are reported as HTTP 503 counts, with assertion failures counted separately. No response bodies, cookies, tokens or database credentials are recorded.',
        'Health probes during image-cache churn pause 5ms between requests so they overlap the image burst; their request latency excludes that pause.',
      ],
    };
    await mkdir(dirname(reportPath), { recursive: true });
    await Bun.write(reportPath, JSON.stringify(report, null, 2) + '\n');
  } finally {
    try {
      await harness.sql`DELETE FROM collections WHERE id=ANY(${collections}::uuid[])`;
    } finally {
      try {
        await harness.stopServer();
      } finally {
        fixtures?.stop();
      }
    }
  }
});

test.each(['unit', 'legend', 'champion', 'battlefield', 'jinx', 'embessa'])(
  'search percentiles for %s retain the existing latency budget',
  async (query) => {
    await bench(
      `search/${query}`,
      () =>
        readJson(`/api/v1/cards?q=${query}&limit=40`, CardsListResponse, {}, (data) => {
          expect(data.data.length).toBeGreaterThan(0);
          if (['unit', 'legend', 'champion', 'battlefield'].includes(query))
            expect(
              data.data.every((card) =>
                `${card.type} ${card.super ?? ''}`.toLowerCase().includes(query)
              )
            ).toBe(true);
        }),
      budgets.searchP95Ms
    );
  }
);
test.each([
  'page=1',
  'page=3',
  'types=Unit&sets=OGN',
  'colors=Body,Mind&colorMode=within',
  'sortBy=price',
])('browse percentiles for %s retain the existing latency budget', async (query) => {
  await bench(
    `browse/${query}`,
    () =>
      readJson(`/api/v1/cards?${query}&limit=40`, CardsListResponse, {}, (data) =>
        expect(data.data.length).toBeGreaterThan(0)
      ),
    budgets.searchP95Ms
  );
});
test('concurrent searches retain serial throughput without request failures', async () => {
  const operation = () => readJson('/api/v1/cards?q=unit&limit=40', CardsListResponse);
  const serial = await bench('search/serial', operation, budgets.searchP95Ms);
  const concurrent = await bench(
    'search/concurrent',
    operation,
    budgets.searchP95Ms * budgets.concurrency,
    budgets.concurrency
  );
  expect(concurrent.requestsPerSecond).toBeGreaterThanOrEqual(
    serial.requestsPerSecond * budgets.minimumConcurrentThroughputRatio
  );
});

test.each([20, 2000, 5000])(
  'quantity lookups retain their latency budget at %i input variants',
  async (size) => {
    const input = batch(size);
    await bench(
      `quantities/${size}`,
      () =>
        readJson(
          '/api/v1/collection/quantities',
          CollectionQuantitiesResponse,
          lookup(input),
          (data) => {
            const owned = new Set(variants);
            expect(data.data.length).toBe(size);
            expect(data.data.map((item) => item.variantNumber)).toEqual(input);
            expect(data.data.filter((item) => item.quantity === 2)).toHaveLength(
              Math.min(size, variants.length)
            );
            expect(
              data.data.every(
                (item) => item.quantity === (owned.has(item.variantNumber) ? 2 : 0)
              )
            ).toBe(true);
          }
        ),
      budgets.quantitiesP95Ms
    );
  }
);
test.each([20, 2000, 5000])(
  'recent activity retains its latency budget at %i input variants',
  async (size) => {
    const input = batch(size);
    await bench(
      `recent-adds/${size}`,
      () =>
        readJson(
          '/api/v1/collection/recent-adds',
          CollectionRecentAddsResponse,
          lookup(input),
          (data) => expect(data.data).toHaveLength(RECENT_COLLECTION_ACTIVITY_LIMIT)
        ),
      budgets.activityP95Ms
    );
  }
);
test.each([20, 2000, 5000])(
  'activity history retains its latency budget at %i input variants',
  async (size) => {
    const input = batch(size);
    await bench(
      `activity/${size}`,
      () =>
        readJson(
          '/api/v1/collection/activity-history',
          CollectionActivityHistoryResponse,
          lookup(input),
          (data) => {
            expect(data.data).toHaveLength(20);
            expect(data.meta.hasMore).toBe(true);
          }
        ),
      budgets.activityP95Ms
    );
  }
);

test('interleaved targeted reads stay within the existing 1.5 full-list comparison', async () => {
  const quantityTimes: number[] = [],
    listTimes: number[] = [];
  await bench(
    'quantities/interleaved',
    async (index) => {
      const quantities = () =>
        readJson(
          '/api/v1/collection/quantities',
          CollectionQuantitiesResponse,
          lookup(batch(20))
        );
      const list = () =>
        readJson(
          '/api/v1/collection',
          CollectionListResponse,
          { headers: credentials() },
          (data) => expect(data.data).toHaveLength(500)
        );
      const first = await (index % 2 ? quantities() : list());
      const second = await (index % 2 ? list() : quantities());
      quantityTimes.push(index % 2 ? first.ms : second.ms);
      listTimes.push(index % 2 ? second.ms : first.ms);
      return index % 2 ? first : second;
    },
    budgets.quantitiesP95Ms,
    1,
    0
  );
  const ratio = percentiles(quantityTimes).p50 / percentiles(listTimes).p50;
  observations.targetedReadComparison = {
    quantities: percentiles(quantityTimes),
    list: percentiles(listTimes),
    medianRatio: ratio,
  };
  expect(percentiles(listTimes).p95).toBeLessThanOrEqual(budgets.collectionListP95Ms);
  expect(ratio).toBeLessThanOrEqual(budgets.quantitiesToListMedianRatio);
});

test('activity cursor pagination measures successive pages without duplicate events', async () => {
  let cursor: z.infer<typeof CollectionActivityHistoryResponse>['meta']['nextCursor'] =
    null;
  const seen = new Set<string>();
  await bench(
    'activity/cursor-pages',
    () =>
      readJson(
        '/api/v1/collection/activity-history',
        CollectionActivityHistoryResponse,
        json(
          { variantNumbers: batch(5000), ...(cursor ? { cursor } : {}) },
          user.cookie
        ),
        (data) => {
          expect(data.data).toHaveLength(20);
          for (const event of data.data) {
            expect(seen.has(event.id)).toBe(false);
            seen.add(event.id);
          }
          cursor = data.meta.nextCursor;
          expect(cursor).not.toBeNull();
        }
      ),
    budgets.activityP95Ms,
    1,
    0
  );
  expect(seen.size).toBe(samples * 20);
});

test('concurrent renewal stays fast and fresh sessions avoid repeated database writes', async () => {
  await harness.sql`UPDATE session SET expires_at=now()+interval '1 day' WHERE token=${user.token}`;
  const operation = () =>
    readJson(
      '/api/v1/collection/quantities',
      CollectionQuantitiesResponse,
      lookup(batch(20))
    );
  await bench(
    'auth/renewal-burst',
    operation,
    budgets.quantitiesP95Ms * budgets.concurrency,
    budgets.concurrency,
    0
  );
  const renewed = (
    await harness.sql`SELECT expires_at,updated_at FROM session WHERE token=${user.token}`
  )[0]!;
  expect(new Date(renewed.expires_at).getTime() - Date.now()).toBeGreaterThan(
    6 * 86400000
  );
  await bench(
    'auth/fresh-session-burst',
    operation,
    budgets.quantitiesP95Ms * budgets.concurrency,
    budgets.concurrency
  );
  expect(
    (
      await harness.sql`SELECT expires_at,updated_at FROM session WHERE token=${user.token}`
    )[0]
  ).toEqual(renewed);
});

test('search diagnostics preserve SQL plans alongside HTTP measurements', async () => {
  const command = await runCommand(app.config, [
    'explain:search',
    '--target=test',
    '--use-env=TEST_DB_URL',
    '--repeat=6',
    '--with-local-service',
    `--output=${plansPath}`,
  ]);
  expect(command.exitCode).toBe(0);
  const plans = z
    .object({
      cases: z.array(
        z.object({ id: z.string(), plan: z.object({ executionTimeMs: z.number() }) })
      ),
      service: z.array(z.unknown()),
    })
    .parse(await Bun.file(plansPath).json());
  expect(plans.cases).toHaveLength(33);
  expect(plans.service).toHaveLength(33);
  observations.searchSql = {
    cases: plans.cases.length,
    executionMs: percentiles(plans.cases.map((item) => item.plan.executionTimeMs)),
  };
  expect(
    percentiles(plans.cases.map((item) => item.plan.executionTimeMs)).p95
  ).toBeLessThanOrEqual(budgets.searchP95Ms);
});

async function image(path: string, thumbnail: boolean): Promise<Sample> {
  const start = performance.now();
  const response = await app.fetch(path, {
    signal: AbortSignal.timeout(5000),
    redirect: 'manual',
  });
  const bytes = await response.arrayBuffer();
  const ms = performance.now() - start;
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(
    thumbnail ? 'image/webp' : 'image/png'
  );
  expect(bytes.byteLength).toBeGreaterThan(0);
  if (!thumbnail)
    expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(imageHash);
  return { ms, status: response.status, bytes: bytes.byteLength };
}
test.each(['original', 'thumbnail'] as const)(
  'a cold %s stampede and memory hits remain fast with blocked S3 writes',
  async (kind) => {
    const blocked = fixtures.blockUploads();
    const key = `cards/stampede-${kind}-${runId}.png`;
    const thumbnail = kind === 'thumbnail';
    const path = '/api/v1/images/' + key + (thumbnail ? '?w=160' : '');
    const uploads = fixtures.counters.uploads;
    try {
      await bench(
        `image/${kind}/cold-stampede`,
        () => image(path, thumbnail),
        budgets.imageP95Ms,
        budgets.concurrency,
        0
      );
      await waitFor(() => fixtures.counters.activeUploads === (thumbnail ? 2 : 1));
      expect(fixtures.cdnReads.get('/' + key)).toBe(1);
      expect(fixtures.counters.uploads - uploads).toBe(thumbnail ? 2 : 1);
      await bench(
        `image/${kind}/warm`,
        () => image(path, thumbnail),
        budgets.imageP95Ms,
        budgets.concurrency
      );
      const cached = await app.fetch(path, { redirect: 'manual' });
      const cachedBytes = await cached.arrayBuffer();
      const etag = cached.headers.get('etag');
      if (!etag) throw new Error('Cached image has no ETag');
      await bench(
        `image/${kind}/conditional`,
        async () => {
          const start = performance.now();
          const response = await app.fetch(path, {
            headers: { 'if-none-match': etag },
            signal: AbortSignal.timeout(5000),
            redirect: 'manual',
          });
          const bytes = await response.arrayBuffer();
          const ms = performance.now() - start;
          expect(response.status).toBe(304);
          expect(bytes.byteLength).toBe(0);
          expect(response.headers.get('x-image-source')).toBe('memory');
          return { ms, bytes: bytes.byteLength, status: response.status };
        },
        budgets.imageP95Ms,
        budgets.concurrency
      );
      if (thumbnail) {
        const metadata = await sharp(Buffer.from(cachedBytes)).metadata();
        expect(metadata.width).toBe(160);
        expect(metadata.height).toBe(213);
      }
    } finally {
      blocked.resolve();
      await waitFor(() => fixtures.counters.activeUploads === 0);
    }
  }
);

test('image-cache churn has bounded upload concurrency, RSS and health latency', async () => {
  const blocked = fixtures.blockUploads();
  const waves = [];
  const uploads = fixtures.counters.uploads;
  try {
    for (let wave = 0; wave < 3; wave++) {
      const load = bench(
        `image/cache-churn-${wave}`,
        (index) =>
          image(`/api/v1/images/cards/memory-${runId}-${wave}-${index}.png`, false),
        budgets.imageP95Ms,
        budgets.concurrency,
        0,
        32
      );
      const health = bench(
        `health/image-load-${wave}`,
        async () => {
          const sample = await readJson('/api/v1/health', HealthResponse);
          await Bun.sleep(5);
          return sample;
        },
        budgets.healthP95Ms
      );
      const completed = await Promise.allSettled([load, health]);
      for (const outcome of completed)
        if (outcome.status === 'rejected') throw outcome.reason;
      waves.push(await resources.snapshot());
    }
    expect(fixtures.counters.uploads - uploads).toBe(8);
    expect(fixtures.counters.activeUploads).toBe(8);
    expect(fixtures.counters.peakUploads).toBeLessThanOrEqual(8);
    observations.imageMemoryWaves = waves;
    const memory = await resources.snapshot();
    if (memory)
      expect(memory.peakRssBytes).toBeLessThanOrEqual(budgets.peakRssMiB * 1024 * 1024);
  } finally {
    blocked.resolve();
    await waitFor(() => fixtures.counters.activeUploads === 0);
  }
  await bench(
    'health/after-image-load',
    () => readJson('/api/v1/health', HealthResponse),
    budgets.healthP95Ms
  );
});

test('sync saturation rejects excess work quickly and drains all jobs after client disconnects', async () => {
  const blocked = fixtures.blockSync();
  const requests: Promise<void>[] = [];
  const controllers: AbortController[] = [];
  const rejected = new Set<number>();
  const kinds: Array<'catalog' | 'prices'> = [];
  const initialRequests = 32;
  const admin = { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN };
  try {
    for (let index = 0; index < initialRequests; index++) {
      const key = index % 2 ? 'prices' : 'catalog';
      kinds.push(key);
      const controller = new AbortController();
      controllers.push(controller);
      requests.push(
        app
          .fetch(`/api/v1/sync/${key}?force=1`, {
            method: 'POST',
            headers: admin,
            signal: controller.signal,
          })
          .then(async (response) => {
            await response.arrayBuffer();
            expect(response.status).toBe(503);
            rejected.add(index);
          })
          .catch((error: unknown) => {
            if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
          })
      );
    }
    await waitFor(
      () =>
        rejected.size === initialRequests - 8 &&
        blocked.started.catalog === 1 &&
        blocked.started.prices === 1
    );
    const accepted = kinds.filter((_, index) => !rejected.has(index));
    const expected = {
      catalog: accepted.filter((key) => key === 'catalog').length,
      prices: accepted.filter((key) => key === 'prices').length,
    };
    await bench(
      'sync/overload-rejection',
      async () => {
        const start = performance.now();
        const response = await app.fetch('/api/v1/sync/catalog', {
          method: 'POST',
          headers: admin,
          signal: AbortSignal.timeout(5000),
        });
        const bytes = await response.arrayBuffer();
        expect(response.status).toBe(503);
        return {
          ms: performance.now() - start,
          bytes: bytes.byteLength,
          status: response.status,
        };
      },
      budgets.syncStatusP95Ms,
      budgets.concurrency,
      0
    );
    await bench(
      'sync/status-under-load',
      () => readJson('/api/v1/sync/status', SyncStatusResponse, { headers: admin }),
      budgets.syncStatusP95Ms
    );
    await bench(
      'health/sync-load',
      () => readJson('/api/v1/health', HealthResponse),
      budgets.healthP95Ms
    );
    for (const controller of controllers) controller.abort();
    await Promise.all(requests);
    const start = performance.now();
    blocked.resolve();
    await waitFor(async () => {
      const response = await app.fetch('/api/v1/sync/status', { headers: admin });
      const status = SyncStatusResponse.parse(await response.json());
      return (
        blocked.started.catalog === expected.catalog &&
        blocked.started.prices === expected.prices &&
        status.data.catalog.status === 'idle' &&
        status.data.prices.status === 'idle'
      );
    }, budgets.syncDrainMs);
    observations.sync = {
      queued: 8,
      initialRejected: rejected.size,
      measuredRejected: samples,
      catalogJobs: blocked.started.catalog,
      priceJobs: blocked.started.prices,
      queueIdleAfterDisconnectMs: performance.now() - start,
    };
    for (const key of ['catalog', 'prices'] as const) {
      const response = await app.fetch('/api/v1/sync/' + key, {
        method: 'POST',
        headers: admin,
      });
      expect(response.status).toBe(200);
      (key === 'catalog' ? SyncCatalogResponse : SyncPricesResponse).parse(
        await response.json()
      );
    }
    observations.sync = {
      ...z.record(z.unknown()).parse(observations.sync),
      completionAndRecoveryMs: performance.now() - start,
    };
    await bench(
      'health/after-sync-load',
      () => readJson('/api/v1/health', HealthResponse),
      budgets.healthP95Ms
    );
  } finally {
    for (const controller of controllers) controller.abort();
    blocked.resolve();
    await Promise.all(requests);
  }
});
