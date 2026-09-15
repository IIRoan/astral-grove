#!/usr/bin/env bun
/** Manual price_history retention. Charts use price_daily; this never runs on prod cron unless enabled. */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as authSchema from '../src/db/auth-schema.js';
import * as schema from '../src/db/schema.js';
import {
  resolvePriceHistoryRetention,
  type PriceHistoryRetention,
} from '../src/lib/price-history-retention.js';
import { PriceCacheService } from '../src/services/price-cache.js';

type Target = 'local' | 'test' | 'staging';

const ALLOWED_ENV_NAMES = [
  'TEST_DB_URL',
  'DATABASE_URL',
  'SEARCH_EXPLAIN_DATABASE_URL',
];

type Args = {
  target: Target;
  databaseUrl: string;
  envName: string | null;
  dryRun: boolean;
  retention: PriceHistoryRetention;
};

function usage(): string {
  return `Usage:
  bun scripts/prune-price-history.ts --target=test --use-env=TEST_DB_URL --dry-run
  bun scripts/prune-price-history.ts --target=staging --database-url=postgres://... --apply

Safety:
  Requires an explicit target and URL. Never defaults to production.
  --target=production is rejected. Use a separately approved window.
  Defaults to --dry-run. Pass --apply to delete.
`;
}

function parseArgs(argv: string[]): Args {
  let target: Target | null = null;
  let databaseUrl: string | null = null;
  let envName: string | null = null;
  let dryRun = true;
  let retainDays: number | undefined;
  let retainSnapshotsPerSlot: number | undefined;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--apply') {
      dryRun = false;
      continue;
    }
    if (arg.startsWith('--target=')) {
      const value = arg.slice('--target='.length);
      if (value === 'production') {
        throw new Error(
          'Refusing --target=production. Price history prune needs a separately approved window.'
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
    if (arg.startsWith('--retain-days=')) {
      const value = Number(arg.slice('--retain-days='.length));
      if (!Number.isFinite(value) || value < 1 || value > 3650) {
        throw new Error('--retain-days must be an integer from 1 to 3650');
      }
      retainDays = Math.floor(value);
      continue;
    }
    if (arg.startsWith('--retain-snapshots=')) {
      const value = Number(arg.slice('--retain-snapshots='.length));
      if (!Number.isFinite(value) || value < 1 || value > 1000) {
        throw new Error('--retain-snapshots must be an integer from 1 to 1000');
      }
      retainSnapshotsPerSlot = Math.floor(value);
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

  const retentionInput: {
    retainDays?: number;
    retainSnapshotsPerSlot?: number;
  } = {};
  if (retainDays !== undefined) retentionInput.retainDays = retainDays;
  if (retainSnapshotsPerSlot !== undefined) {
    retentionInput.retainSnapshotsPerSlot = retainSnapshotsPerSlot;
  }

  return {
    target,
    databaseUrl,
    envName,
    dryRun,
    retention: resolvePriceHistoryRetention(retentionInput),
  };
}

function redactUrl(url: string): { host: string; database: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      database: parsed.pathname.replace(/^\//, '') || '(default)',
    };
  } catch {
    return { host: '(unparseable)', database: '(unparseable)' };
  }
}

function assertSafeTarget(target: Target, url: string): void {
  const { host } = redactUrl(url);
  const looksRailway = host.includes('railway') || host.includes('rlwy.net');
  const looksLocal =
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('::1') ||
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
  const prices = new PriceCacheService(db);

  try {
    const result = await prices.pruneHistory(args.retention, { dryRun: args.dryRun });
    console.log(
      JSON.stringify(
        {
          target: args.target,
          host: redacted.host,
          database: redacted.database,
          envName: args.envName,
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

await main();
