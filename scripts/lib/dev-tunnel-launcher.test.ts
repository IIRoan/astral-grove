import { expect, test } from 'bun:test';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

test('the real tunnel launcher passes only API ingress and an allowlisted environment to cloudflared', async () => {
  const root = resolve(import.meta.dir, '../..');
  const directory = await mkdtemp(join(tmpdir(), 'astral-tunnel-'));
  const health = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (request) =>
      new Response(null, {
        status: new URL(request.url).pathname === '/api/v1/health' ? 200 : 404,
      }),
  });
  try {
    for (const path of [
      'scripts/lib',
      'apps/backend',
      'apps/mobile',
      'cloudflared',
      'bin',
      'home',
    ])
      await mkdir(join(directory, path), { recursive: true });
    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
    for (const path of ['scripts/dev-tunnel.mjs', 'scripts/lib/dev-tunnel.ts'])
      await writeFile(join(directory, path), await readFile(join(root, path)));
    await writeFile(
      join(directory, 'apps/backend/.env'),
      'PUBLIC_API_URL=https://dev.example.com\nDATABASE_URL=synthetic-private-database\nS3_SECRET_ACCESS_KEY=synthetic-private-key\n'
    );
    await writeFile(
      join(directory, 'cloudflared/config.yml'),
      'tunnel: fixture-tunnel\ncredentials-file: /tmp/synthetic-credentials.json\ningress:\n  - service: http://localhost:7001\n'
    );
    const capture = join(directory, 'capture.json');
    const command = join(directory, 'bin/cloudflared');
    await writeFile(
      command,
      `#!${process.execPath}\nconst args = process.argv.slice(2);\nawait Bun.write(${JSON.stringify(capture)}, JSON.stringify({ args, env: Object.keys(process.env), config: Bun.YAML.parse(await Bun.file(args[args.indexOf('--config') + 1]).text()) }));\n`
    );
    await chmod(command, 0o700);
    const child = Bun.spawn(
      [process.execPath, '--no-env-file', 'scripts/dev-tunnel.mjs'],
      {
        cwd: directory,
        env: {
          PATH: join(directory, 'bin') + ':' + (process.env.PATH ?? ''),
          HOME: join(directory, 'home'),
          PORT: String(health.port),
          DATABASE_URL: 'synthetic-parent-secret',
          S3_SECRET_ACCESS_KEY: 'synthetic-parent-key',
          EXPO_TOKEN: 'synthetic-parent-token',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    expect(await child.exited).toBe(0);
    const result = z
      .object({
        args: z.array(z.string()),
        env: z.array(z.string()),
        config: z.object({
          ingress: z.array(
            z
              .object({
                service: z.string(),
                path: z.string().optional(),
                hostname: z.string().optional(),
              })
              .strict()
          ),
        }),
      })
      .parse(await Bun.file(capture).json());
    expect(result.args).toEqual([
      'tunnel',
      '--config',
      join(directory, '.dev/api-tunnel.yml'),
      'run',
      'fixture-tunnel',
    ]);
    expect(result.env).not.toContain('DATABASE_URL');
    expect(result.env).not.toContain('S3_SECRET_ACCESS_KEY');
    expect(result.env).not.toContain('EXPO_TOKEN');
    expect(result.config.ingress).toEqual([
      {
        hostname: 'dev.example.com',
        path: '^/api/(v1|auth)(/|$)',
        service: `http://127.0.0.1:${health.port}`,
      },
      { service: 'http_status:404' },
    ]);
    expect(await readFile(join(directory, 'apps/mobile/.env'), 'utf8')).toContain(
      'EXPO_PUBLIC_API_URL=https://dev.example.com'
    );
  } finally {
    health.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
