import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { Env } from '../env.js';
import { createPostgresOptions } from './client.js';
import { isTransientDbError } from './transient-errors.js';

export { isTransientDbError } from './transient-errors.js';

function formatDbError(error: unknown): string {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string };
    return withCode.code ? `${withCode.code}: ${error.message}` : error.message;
  }
  return String(error);
}

export async function runStartupMigrations(env: Env): Promise<void> {
  const migrationsFolder = join(import.meta.dir, '..', '..', 'drizzle');
  const maxAttempts = env.NODE_ENV === 'production' ? 12 : 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = postgres(env.DATABASE_URL, {
      ...createPostgresOptions(env),
      max: 1,
    });

    try {
      await migrate(drizzle(client), { migrationsFolder });
      return;
    } catch (error) {
      if (!isTransientDbError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = Math.min(attempt * 1000, 5000);
      console.warn(
        `Database migration attempt ${String(attempt)}/${String(maxAttempts)} failed (${formatDbError(error)}); retrying in ${String(delayMs)}ms`
      );
      await Bun.sleep(delayMs);
    } finally {
      await client.end({ timeout: 5 });
    }
  }
}
