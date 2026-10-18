import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(import.meta.dir, '../../scripts/explain-search.ts');

function run(args: string[]) {
  return spawnSync('bun', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, TEST_DB_URL: undefined, DATABASE_URL: 'postgres://example' },
  });
}

describe('explain-search safety', () => {
  test('refuses a production target', () => {
    const result = run(['--target=production', '--use-env=TEST_DB_URL']);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('production');
  });

  test('refuses to guess a database URL', () => {
    const result = run(['--target=test']);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Missing --database-url');
  });
});
