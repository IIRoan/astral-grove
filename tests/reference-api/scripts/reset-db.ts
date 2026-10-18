#!/usr/bin/env bun
/** Drop all tables and re-apply migrations; refuses remote DATABASE_URL unless CONFIRM_DB_RESET=1. */
import postgres from 'postgres';
import { createApp } from '../src/app.js';
import { runStartupMigrations } from '../src/db/migrate.js';
import { loadEnv } from '../src/env.js';
import { PriceCacheService } from '../src/services/price-cache.js';

const LOCAL_DEFAULT_URL = 'postgres://riftbound:riftbound@localhost:5433/riftbound';

function parseArgs(argv: string[]) {
  return {
    catalog: argv.includes('--catalog'),
    prices: argv.includes('--prices'),
    local: argv.includes('--local'),
  };
}

function resolveDatabaseUrl(useLocal: boolean): string {
  if (useLocal) return LOCAL_DEFAULT_URL;
  return process.env.DATABASE_URL ?? LOCAL_DEFAULT_URL;
}

function assertSafeToReset(databaseUrl: string): void {
  let host = '';
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${databaseUrl}`);
  }

  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'postgres' ||
    host.endsWith('.local');

  if (!isLocal && process.env.CONFIRM_DB_RESET !== '1') {
    throw new Error(
      `Refusing to reset remote database (${host}). Set CONFIRM_DB_RESET=1 to override, or pass --local for Docker Postgres on port 5433.`
    );
  }
}

async function wipeDatabase(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    console.log('[db:reset] Dropping public + drizzle schemas…');
    await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await client.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await client.unsafe('CREATE SCHEMA public');
    await client.unsafe('GRANT ALL ON SCHEMA public TO public');
    console.log('[db:reset] Schemas wiped.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl(args.local);
  assertSafeToReset(databaseUrl);

  process.env.DATABASE_URL = databaseUrl;
  const env = loadEnv();

  await wipeDatabase(databaseUrl);
  await runStartupMigrations(env);

  if (!args.catalog && !args.prices) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          databaseUrl,
          migrated: true,
          hint: 'Pass --catalog and/or --prices to sync data after reset.',
        },
        null,
        2
      )
    );
    return;
  }

  const ctx = createApp(env);

  try {
    if (args.catalog) {
      console.log('[db:reset] Syncing catalog from Piltover Archive…');
      const catalog = await ctx.syncEngine.syncCatalog();
      console.log('[db:reset] Catalog sync:', catalog);
    }

    if (args.prices) {
      console.log('[db:reset] Syncing Cardmarket prices…');
      const prices = new PriceCacheService(ctx.db);
      const result = await prices.syncFromCardmarket(env.CARDMARKET_GAME_ID, {
        trigger: 'script',
      });
      console.log('[db:reset] Price sync:', result);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          databaseUrl,
          catalog: args.catalog,
          prices: args.prices,
        },
        null,
        2
      )
    );
  } finally {
    await ctx.client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error('[db:reset] Failed:', error);
  process.exit(1);
});
