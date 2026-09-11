#!/usr/bin/env bun
/** Database-only search diagnostic. Never calls API search (that can backfill from PA). */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as authSchema from '../src/db/auth-schema.js';
import type { Database } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { SEARCH_BENCHMARK_CASES } from '../src/lib/search-benchmark-cases.js';
import {
  buildSearchCandidateQuery,
  buildSearchCandidateQueryUnsorted,
  buildSearchWhere,
  shouldMaterializeThenPage,
} from '../src/lib/search-sql.js';
import {
  CardCacheService,
  type LocalSearchTimings,
} from '../src/services/card-cache.js';
import { EmbeddingService } from '../src/services/embeddings.js';
import type { ImageStoreService } from '../src/services/image-store.js';
import { PriceCacheService } from '../src/services/price-cache.js';
import type { PaClient } from '../src/upstream/pa-client.js';

type Target = 'local' | 'test' | 'staging';

const STATEMENT_TIMEOUT_MS = 30_000;
const ALLOWED_ENV_NAMES = [
  'TEST_DB_URL',
  'DATABASE_URL',
  'SEARCH_EXPLAIN_DATABASE_URL',
];

type Args = {
  target: Target;
  databaseUrl: string;
  envName: string | null;
  outputPath: string | null;
  withLocalService: boolean;
  repeat: number;
};

function usage(): string {
  return `Usage:
  bun scripts/explain-search.ts --target=local|test|staging --database-url=postgres://...
  bun scripts/explain-search.ts --target=test --use-env=TEST_DB_URL

Safety:
  Requires an explicit target and URL. Never defaults to production.
  --target=production is rejected. Connection strings are never printed.
  --with-local-service runs CardCacheService.searchLocalWithoutUpstream (no PA).
`;
}

function parseArgs(argv: string[]): Args {
  let target: Target | null = null;
  let databaseUrl: string | null = null;
  let envName: string | null = null;
  let outputPath: string | null = null;
  let withLocalService = false;
  let repeat = 1;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--with-local-service') {
      withLocalService = true;
      continue;
    }
    if (arg.startsWith('--target=')) {
      const value = arg.slice('--target='.length);
      if (value === 'production') {
        throw new Error(
          'Refusing --target=production. Use a separately approved window.'
        );
      }
      if (value !== 'local' && value !== 'test' && value !== 'staging') {
        throw new Error(`Unknown --target=${value}`);
      }
      target = value;
      continue;
    }
    if (arg.startsWith('--database-url=')) {
      databaseUrl = arg.slice('--database-url='.length);
      continue;
    }
    if (arg.startsWith('--use-env=')) {
      envName = arg.slice('--use-env='.length);
      continue;
    }
    if (arg.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length);
      continue;
    }
    if (arg.startsWith('--repeat=')) {
      const value = Number(arg.slice('--repeat='.length));
      if (!Number.isFinite(value) || value < 1 || value > 500) {
        throw new Error('--repeat must be an integer from 1 to 500');
      }
      repeat = Math.floor(value);
    }
  }

  if (!target) {
    throw new Error('Missing --target. ' + usage());
  }
  if (databaseUrl && envName) {
    throw new Error('Pass either --database-url or --use-env, not both.');
  }
  if (!databaseUrl && !envName) {
    throw new Error(
      'Missing --database-url or --use-env. Refusing to guess a database.'
    );
  }
  if (envName) {
    if (!ALLOWED_ENV_NAMES.includes(envName)) {
      throw new Error(`--use-env must be one of ${ALLOWED_ENV_NAMES.join(', ')}`);
    }
    const fromEnv = process.env[envName];
    if (!fromEnv) {
      throw new Error(`${envName} is not set`);
    }
    databaseUrl = fromEnv;
  }
  if (!databaseUrl) {
    throw new Error('Database URL is missing');
  }
  if (
    target === 'local' &&
    envName === 'DATABASE_URL' &&
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error('Refusing DATABASE_URL while NODE_ENV=production');
  }

  return { target, databaseUrl, envName, outputPath, withLocalService, repeat };
}

function redactUrl(url: string): { host: string; database: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, database: parsed.pathname.replace(/^\//, '') };
  } catch {
    return { host: '(unparseable)', database: '(unparseable)' };
  }
}

function assertSafeTarget(target: Target, url: string): void {
  const { host } = redactUrl(url);
  const looksRailway = host.includes('railway') || host.includes('rlwy.net');
  const looksLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local');
  if (target === 'local' && looksRailway) {
    throw new Error('Refusing a remote host for --target=local');
  }
  if (target === 'test' && looksRailway) {
    throw new Error('Refusing a remote host for --target=test');
  }
  if (target === 'staging' && looksLocal) {
    throw new Error('--target=staging requires a non-local explicit URL');
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return Math.round((sorted[index] ?? 0) * 100) / 100;
}

function timingPercentiles(
  samples: LocalSearchTimings[]
): Record<string, { p50: number; p95: number }> | null {
  if (samples.length === 0) return null;
  const keys: (keyof LocalSearchTimings)[] = [
    'dbMs',
    'colorsMs',
    'pricesMs',
    'mapMs',
    'groupMs',
    'countMs',
    'rankMs',
    'totalMs',
  ];
  const out: Record<string, { p50: number; p95: number }> = {};
  for (const key of keys) {
    const values = samples.map((sample) => sample[key]);
    out[key] = { p50: percentile(values, 50), p95: percentile(values, 95) };
  }
  return out;
}

function summarizePlan(plan: unknown): Record<string, unknown> {
  if (!plan || typeof plan !== 'object') return {};
  const root = plan as Record<string, unknown>;
  return {
    planningTimeMs: root['Planning Time'],
    executionTimeMs: root['Execution Time'],
    nodeType: root['Node Type'],
    actualRows: root['Actual Rows'],
    planRows: root['Plan Rows'],
    sharedHitBlocks: root['Shared Hit Blocks'],
    sharedReadBlocks: root['Shared Read Blocks'],
    rowsRemovedByFilter: root['Rows Removed by Filter'],
  };
}

async function captureCatalog(sql: postgres.Sql): Promise<Record<string, unknown>> {
  const version = await sql<{ version: string }[]>`select version()`;
  const collation = await sql<{ datcollate: string; datctype: string }[]>`
    select datcollate, datctype from pg_database where datname = current_database()
  `;
  const extensions = await sql<
    { extname: string; extversion: string; nspname: string }[]
  >`
    select e.extname, e.extversion, n.nspname
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname in ('pg_trgm', 'unaccent', 'vector')
    order by e.extname
  `;
  const relations = await sql<
    { relname: string; relkind: string; reltuples: number; sizeBytes: string }[]
  >`
    select c.relname, c.relkind, c.reltuples::bigint as reltuples,
           pg_relation_size(c.oid)::text as "sizeBytes"
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('cards', 'variants', 'sets', 'prices')
    order by c.relname
  `;
  const indexes = await sql<
    { indexname: string; tablename: string; indexdef: string; sizeBytes: string }[]
  >`
    select i.indexname, i.tablename, i.indexdef, pg_relation_size(i.indexname::regclass)::text as "sizeBytes"
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename in ('cards', 'variants', 'sets')
    order by i.tablename, i.indexname
  `;
  const stats = await sql<
    { relname: string; lastAnalyze: string | null; lastAutoanalyze: string | null }[]
  >`
    select relname, last_analyze::text as "lastAnalyze", last_autoanalyze::text as "lastAutoanalyze"
    from pg_stat_user_tables
    where schemaname = 'public' and relname in ('cards', 'variants', 'sets', 'prices')
    order by relname
  `;
  return {
    postgresVersion: version[0]?.version ?? null,
    collation: collation[0] ?? null,
    extensions,
    relations,
    indexes: indexes.map((row) => ({
      name: row.indexname,
      table: row.tablename,
      sizeBytes: row.sizeBytes,
      definition: row.indexdef,
    })),
    statsFreshness: stats,
  };
}

async function captureLocalService(
  db: Database,
  repeat: number
): Promise<Record<string, unknown>[]> {
  process.env.SEARCH_METRICS_LOG = 'false';
  const prices = new PriceCacheService(db);
  const embeddings = new EmbeddingService(db, 'none', undefined);
  const cardCache = new CardCacheService(
    db,
    {
      getCard: async () => {
        throw new Error('explain-search must not call Piltover Archive');
      },
    } as unknown as PaClient,
    prices,
    {
      rewriteCard: (card: unknown) => card,
      rewriteImageUrl: (url: string) => url,
    } as unknown as ImageStoreService,
    embeddings
  );

  const cases: Record<string, unknown>[] = [];
  for (const benchmark of SEARCH_BENCHMARK_CASES) {
    const samples: Array<{
      total: number;
      items: number;
      timings: LocalSearchTimings;
    }> = [];
    for (let i = 0; i < repeat; i += 1) {
      const result = await cardCache.searchLocalWithoutUpstream(benchmark.query);
      samples.push({
        total: result.total,
        items: result.items.length,
        timings: result.timings,
      });
    }
    const first = samples[0];
    const warmed = samples.slice(1);
    cases.push({
      id: benchmark.id,
      total: first?.total ?? 0,
      items: first?.items ?? 0,
      coldTimings: first?.timings ?? null,
      warmedPercentiles: timingPercentiles(warmed.map((sample) => sample.timings)),
    });
  }
  return cases;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertSafeTarget(args.target, args.databaseUrl);
  const redacted = redactUrl(args.databaseUrl);

  const client = postgres(args.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: args.target === 'staging' ? 'require' : undefined,
  });
  const db = drizzle(client, { schema: { ...authSchema, ...schema } });

  try {
    const catalog = await captureCatalog(client);
    const cases = [];

    for (const benchmark of SEARCH_BENCHMARK_CASES) {
      const where = buildSearchWhere(benchmark.query);
      const materializeThenPage = shouldMaterializeThenPage(benchmark.query);
      const query = materializeThenPage
        ? buildSearchCandidateQueryUnsorted(db, where)
        : buildSearchCandidateQuery(db, benchmark.query)
            .limit(benchmark.query.limit)
            .offset((benchmark.query.page - 1) * benchmark.query.limit);
      const compiled = query.toSQL();

      const explain = await client.begin(async (tx) => {
        await tx`SET TRANSACTION READ ONLY`;
        await tx.unsafe(
          `SET LOCAL statement_timeout = '${String(STATEMENT_TIMEOUT_MS)}ms'`
        );
        const rows = await tx.unsafe(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${compiled.sql}`,
          compiled.params as never[]
        );
        return rows;
      });

      const planJson = (explain[0] as { 'QUERY PLAN'?: unknown } | undefined)?.[
        'QUERY PLAN'
      ];
      const planRoot = Array.isArray(planJson) ? planJson[0] : planJson;
      const plan = (planRoot as { Plan?: unknown } | undefined)?.Plan ?? planRoot;
      cases.push({
        id: benchmark.id,
        materializeThenPage,
        page: benchmark.query.page,
        limit: benchmark.query.limit,
        sortBy: benchmark.query.sortBy,
        plan: summarizePlan(plan),
        planJson: planRoot,
      });
    }

    const serviceCases = args.withLocalService
      ? await captureLocalService(db, args.repeat)
      : null;

    const report = {
      generatedAt: new Date().toISOString(),
      target: args.target,
      host: redacted.host,
      database: redacted.database,
      envName: args.envName,
      catalog,
      cases,
      service: serviceCases,
      notes: [
        'This diagnostic does not call API search and does not reconcile with Piltover Archive.',
        'Text searches bypass the in-process result cache; service-cache cold/warm is N/A for q queries.',
        'Do not restart production or flush buffers to simulate a cold database.',
        'Fuzzy unnest+similarity is a residual card-table scan; capture it separately from hydration.',
        args.withLocalService
          ? `--with-local-service used searchLocalWithoutUpstream; --repeat=${String(args.repeat)} (first sample is process-cold, later samples are process-warm).`
          : '--with-local-service was not set; database EXPLAIN only.',
      ],
    };

    const serialized = JSON.stringify(report, null, 2);
    if (args.outputPath) {
      const outputPath = resolve(args.outputPath);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, serialized);
      console.log(`Wrote search explain report to ${outputPath}`);
    } else {
      console.log(serialized);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (!existsSync(resolve(import.meta.dir, '../src/lib/search-sql.ts'))) {
  throw new Error('explain-search.ts must run from the apps/api package');
}

await main();
