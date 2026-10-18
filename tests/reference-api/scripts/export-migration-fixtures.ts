import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { requireLocalTestDatabase } from '../../../scripts/rust-migration/test-target';

const source = requireLocalTestDatabase(process.env.TEST_DB_URL);
const db = postgres(source, { max: 1 });
const tables = [
  'sets',
  'colors',
  'cards',
  'card_colors',
  'variants',
  'prices',
  'price_daily',
  'price_history',
  'filter_snapshots',
  'sync_state',
] as const;
const data: Record<string, unknown> = {};
try {
  await db.begin('READ ONLY', async (tx) => {
    for (const table of tables) {
      data[table] = await tx.unsafe(`SELECT * FROM ${table}`);
    }
  });
  const text = JSON.stringify(data);
  const target = resolve(import.meta.dir, '../test/fixtures/migration');
  mkdirSync(target, { recursive: true });
  writeFileSync(`${target}/catalog.json.gz`, gzipSync(text, { level: 9 }));
  writeFileSync(
    `${target}/catalog.sha256`,
    `${createHash('sha256').update(text).digest('hex')}\n`
  );
  console.log(
    `Exported ${tables.length} public catalog/cache tables; no user, auth, collection or owned deck tables`
  );
} finally {
  await db.end();
}
