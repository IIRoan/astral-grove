#!/usr/bin/env bun
// Starts local Postgres, ensures the riftbound_test database exists, then runs every package's tests.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const psql = (...args) =>
  spawnSync(
    'docker',
    ['exec', 'riftbound-postgres', 'psql', '-U', 'riftbound', '-d', 'riftbound', ...args],
    { encoding: 'utf8' }
  );

if (existsSync(join(root, 'docker-compose.yml'))) {
  spawnSync('docker', ['compose', 'up', '-d', 'postgres'], { cwd: root, stdio: 'inherit' });
  const deadline = Date.now() + 60_000;
  while (psql('-c', 'select 1').status !== 0) {
    if (Date.now() > deadline) {
      console.error('Postgres did not become ready within 60 seconds.');
      process.exit(1);
    }
    await Bun.sleep(1_000);
  }
  if (psql('-tAc', "SELECT 1 FROM pg_database WHERE datname = 'riftbound_test'").stdout.trim() !== '1') {
    psql('-c', 'CREATE DATABASE riftbound_test');
  }
}

// Never let e2e fall through to DATABASE_URL, which may point at production.
process.env.TEST_DB_URL ??= 'postgres://riftbound:riftbound@localhost:5433/riftbound_test';

const result = spawnSync('bun', ['run', 'turbo', 'test'], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
