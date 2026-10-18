#!/usr/bin/env bun
/** Download Cardmarket's daily Riftbound price guide and upsert local price cache. */
import { createDb } from '../src/db/client.js';
import { runStartupMigrations } from '../src/db/migrate.js';
import { loadEnv } from '../src/env.js';
import { PriceCacheService } from '../src/services/price-cache.js';

async function main() {
  const env = loadEnv();
  await runStartupMigrations(env);

  const { db, client } = createDb(env);
  const prices = new PriceCacheService(db);

  try {
    const result = await prices.syncFromCardmarket(env.CARDMARKET_GAME_ID, {
      trigger: 'script',
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...result,
        },
        null,
        2
      )
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error('Cardmarket price sync failed:', error);
  process.exit(1);
});
