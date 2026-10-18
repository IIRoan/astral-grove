import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const configUrl = pathToFileURL(
  resolve(import.meta.dir, '../../drizzle.config.ts')
).href;

function configuredDatabaseUrl(envFile?: string, databaseUrl?: string): string {
  const cwd = mkdtempSync(join(tmpdir(), 'astral-grove-drizzle-'));
  try {
    if (envFile !== undefined) writeFileSync(join(cwd, '.env'), envFile);
    const result = spawnSync(
      process.execPath,
      [
        '--no-env-file',
        '-e',
        `const { default: config } = await import(${JSON.stringify(configUrl)}); process.stdout.write(config.dbCredentials.url);`,
      ],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: databaseUrl },
      }
    );
    expect(result.status).toBe(0);
    return result.stdout;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('Drizzle database configuration', () => {
  test('defaults to the local Compose database when no environment is configured', () => {
    expect(configuredDatabaseUrl()).toBe(
      'postgres://riftbound:riftbound@localhost:5433/riftbound'
    );
  });

  test('loads a database URL from the API environment file', () => {
    const url = 'postgres://example:example@localhost:6543/example';
    expect(configuredDatabaseUrl(`DATABASE_URL="${url}"\n`)).toBe(url);
  });

  test('preserves an explicit deployment environment over the environment file', () => {
    const url = 'postgres://example:example@deployment.invalid:5432/example';
    expect(
      configuredDatabaseUrl('DATABASE_URL=postgres://localhost/local\n', url)
    ).toBe(url);
  });
});
