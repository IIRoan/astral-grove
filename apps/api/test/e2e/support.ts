import { FiltersResponse } from '@riftbound/contracts';
import { count } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createApp, type AppContext } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/env.js';
import { apiListenOptions } from '../../src/lib/http-listen.js';
import { filterSnapshots, syncState, variants } from '../../src/db/schema.js';
import { entityHash } from '../../src/lib/hash.js';
import {
  enrichedFilterSnapshot,
  expectedCatalogTotal,
} from '../fixtures/enriched-filters.js';

const E2E_PORT = Number(process.env.E2E_PORT ?? 3099);
const API_ROOT = join(import.meta.dir, '../..');

function loadDotEnvFile(): void {
  const envPath = join(API_ROOT, '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile();

/** E2E auth expects immediate sessions; Stalwart mail covered by unit mocks. */
function disableTransactionalEmailForE2E(): void {
  delete process.env.STALWART_JMAP_URL;
  delete process.env.STALWART_JMAP_USERNAME;
  delete process.env.STALWART_JMAP_PASSWORD;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_FROM_NAME;
}

/** Keep invite / reset link hosts deterministic in e2e (ignore developer PUBLIC_APP_URL). */
function pinPublicAppUrlForE2E(): void {
  process.env.PUBLIC_APP_URL =
    process.env.E2E_PUBLIC_APP_URL ?? 'http://localhost:7001';
}

disableTransactionalEmailForE2E();
pinPublicAppUrlForE2E();

let ctx: AppContext | null = null;
let ownsServer = false;
let baseUrl = '';

function applyTestDatabaseUrl(): void {
  if (process.env.TEST_DB_URL) {
    process.env.DATABASE_URL = process.env.TEST_DB_URL;
  }
}

export function getBaseUrl(): string {
  if (!baseUrl) {
    throw new Error('E2E setup has not run yet');
  }
  return baseUrl;
}

export function getEnv(): Env {
  applyTestDatabaseUrl();
  return loadEnv();
}

export function getContext(): AppContext {
  if (!ctx) {
    throw new Error('E2E setup has not run yet');
  }
  return ctx;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${getBaseUrl()}${path}`, init);
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `E2E ${init?.method ?? 'GET'} ${path} → ${String(res.status)}: ${body}`
    );
  }
  return JSON.parse(body) as T;
}

async function runMigrations(databaseUrl: string): Promise<void> {
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const migrationDb = drizzle(migrationClient);
  const migrationsFolder = join(import.meta.dir, '../../drizzle');
  await migrate(migrationDb, { migrationsFolder });
  await migrationClient.end({ timeout: 5 });
}

async function runMigrationsWithRetry(databaseUrl: string): Promise<void> {
  const attempts = 10;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await runMigrations(databaseUrl);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await Bun.sleep(1_000 * attempt);
    }
  }
}

export async function setupE2E(): Promise<void> {
  if (baseUrl) return;

  process.env.NODE_ENV ??= 'test';
  process.env.SYNC_CRON_ENABLED = 'false';
  process.env.SYNC_MAX_PAGES ??= '2';
  applyTestDatabaseUrl();

  const externalUrl = process.env.E2E_API_URL;
  if (!externalUrl) {
    const e2eOrigin = `http://localhost:${String(E2E_PORT)}`;
    process.env.BETTER_AUTH_URL = e2eOrigin;
    const existing = (process.env.TRUSTED_ORIGINS ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    process.env.TRUSTED_ORIGINS = [...new Set([...existing, e2eOrigin])].join(',');
  }

  const env = loadEnv();
  await runMigrationsWithRetry(env.DATABASE_URL);

  if (externalUrl) {
    baseUrl = externalUrl.replace(/\/$/, '');
    const health = await fetch(`${baseUrl}/api/v1/health`);
    if (!health.ok) {
      throw new Error(`E2E_API_URL is not reachable: ${baseUrl}`);
    }
    return;
  }

  ctx = createApp(env);
  ctx.app.listen(apiListenOptions(E2E_PORT));
  ownsServer = true;
  baseUrl = `http://localhost:${String(E2E_PORT)}`;

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) break;
    } catch {}
    await Bun.sleep(200);
  }

  await assertSearchSchemaReady();
}

export async function teardownE2E(): Promise<void> {
  if (ownsServer && ctx) {
    await ctx.client.end({ timeout: 5 });
    ctx = null;
    ownsServer = false;
  }
}

export async function assertSearchSchemaReady(): Promise<void> {
  const { client } = getContext();
  const extensions = (await client.unsafe(
    `select extname from pg_extension where extname in ('pg_trgm', 'unaccent')`
  )) as { extname: string }[];
  const names = new Set(extensions.map((row) => row.extname));
  if (!names.has('pg_trgm') || !names.has('unaccent')) {
    throw new Error(
      `Search e2e requires pg_trgm and unaccent; found ${[...names].join(',') || '(none)'}`
    );
  }

  const fn = (await client.unsafe(
    `select proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'normalize_card_name_v1'`
  )) as { proname: string }[];
  if (fn.length === 0) {
    throw new Error('normalize_card_name_v1 is missing; apply migration 0012');
  }

  const cols = (await client.unsafe(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'cards'
       and column_name in ('name_norm', 'name_squashed', 'rules_search_text')`
  )) as { column_name: string }[];
  if (cols.length < 3) {
    throw new Error('cards generated search columns are missing; apply migration 0012');
  }
}

async function seedFilterSnapshot(app: AppContext): Promise<void> {
  const hash = entityHash(enrichedFilterSnapshot);
  await app.db.insert(filterSnapshots).values({
    snapshot: enrichedFilterSnapshot,
    contentHash: hash,
  });
  await app.db
    .insert(syncState)
    .values({
      key: 'catalog',
      status: 'idle',
      contentHash: hash,
      rowCount: expectedCatalogTotal,
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: null,
    })
    .onConflictDoUpdate({
      target: syncState.key,
      set: {
        status: 'idle',
        contentHash: hash,
        rowCount: expectedCatalogTotal,
        lastAttemptAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
      },
    });
}

export async function ensureCatalogSynced(): Promise<void> {
  if (ctx) {
    await seedFilterSnapshot(ctx);
    const [row] = await ctx.db.select({ value: count() }).from(variants);
    if ((row?.value ?? 0) > 0) return;
    await ctx.syncEngine.syncCatalog();
    return;
  }

  const filters = await apiJson<unknown>('/api/v1/filters').catch(() => null);
  if (filters) {
    const parsed = FiltersResponse.parse(filters);
    if (
      parsed.meta.variantCount === expectedCatalogTotal &&
      parsed.data.sets.some((set) => set.printCount != null)
    ) {
      return;
    }
  }

  const token = getEnv().ADMIN_SYNC_TOKEN;
  await apiJson('/api/v1/sync/catalog', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function syncPricesForE2E(): Promise<void> {
  if (ctx) {
    await ctx.priceCache.syncFromCardmarket(getEnv().CARDMARKET_GAME_ID);
    return;
  }

  const token = getEnv().ADMIN_SYNC_TOKEN;
  await apiJson('/api/v1/sync/prices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminAuthHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getEnv().ADMIN_SYNC_TOKEN}` };
}

export async function ensurePricesSynced(): Promise<void> {
  const status = await apiJson<{
    data: { prices: { rowCount: number } };
  }>('/api/v1/sync/status', {
    headers: { Authorization: `Bearer ${getEnv().ADMIN_SYNC_TOKEN}` },
  });

  if (status.data.prices.rowCount > 0) return;

  await syncPricesForE2E();
}
