import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Options } from 'postgres';
import type { Env } from '../env.js';
import * as authSchema from './auth-schema.js';
import { withPostgresRetry } from './postgres-retry.js';
import * as schema from './schema.js';

const fullSchema = { ...authSchema, ...schema };

export function resolveSsl(
  databaseUrl: string,
  isProduction: boolean
): Options<Record<string, never>>['ssl'] | undefined {
  try {
    const sslmode = new URL(databaseUrl).searchParams.get('sslmode');
    if (sslmode === 'disable') return undefined;
    if (sslmode === 'require' || sslmode === 'verify-full' || sslmode === 'verify-ca') {
      return 'require';
    }
  } catch {}
  return isProduction ? 'require' : undefined;
}

export function createPostgresOptions(env: Env): Options<Record<string, never>> {
  const isProduction = env.NODE_ENV === 'production';
  const ssl = resolveSsl(env.DATABASE_URL, isProduction);

  return {
    max: env.DB_POOL_MAX ?? (isProduction ? 10 : 20),
    idle_timeout: 20,
    max_lifetime: isProduction ? 60 * 30 : 60 * 5,
    connect_timeout: 30,
    keep_alive: 30,
    prepare: false,
    ...(ssl ? { ssl } : {}),
  };
}

export function createDb(env: Env) {
  const client = withPostgresRetry(
    postgres(env.DATABASE_URL, createPostgresOptions(env))
  );
  const db = drizzle(client, { schema: fullSchema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>['db'];
