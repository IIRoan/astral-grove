import { expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the backend launcher rejects database routing overrides before starting a process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'astral-cli-'));
  try {
    await mkdir(join(directory, 'scripts'), { recursive: true });
    await mkdir(join(directory, 'target/debug'), { recursive: true });
    await writeFile(
      join(directory, 'scripts/backend-cli.mjs'),
      await readFile(new URL('../backend-cli.mjs', import.meta.url))
    );
    const binary = join(directory, 'target/debug/astral-grove-server');
    await writeFile(binary, `#!${process.execPath}\nconsole.log('fixture backend');\n`);
    await chmod(binary, 0o700);
    for (const query of [
      '',
      '?sslmode=disable&application_name=fixture',
      '?host=production.example.test',
      '?hostaddr=192.0.2.1',
      '?port=6543',
      '?dbname=production',
      '?database=production',
      '?%68ost=production.example.test',
    ]) {
      const allowed = query === '' || query.startsWith('?sslmode=');
      const child = Bun.spawn(
        [process.execPath, '--no-env-file', 'scripts/backend-cli.mjs', 'migrate'],
        {
          cwd: directory,
          env: {
            ASTRAL_NATIVE_ENV_LOADED: '1',
            ASTRAL_SKIP_BUILD: '1',
            DATABASE_URL: `postgres://fixture:fixture@localhost/riftbound_test${query}`,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const [code, output, errors] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(code, query).toBe(allowed ? 0 : 1);
      expect(output.includes('fixture backend'), query).toBe(allowed);
      if (!allowed) expect(errors).toContain('Refusing');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
