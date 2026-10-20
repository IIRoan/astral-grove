import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
async function run(command, args, env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
  const stop = (signal) => child.kill(signal);
  const interrupt = () => stop('SIGINT'),
    terminate = () => stop('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) =>
        resolve(code ?? (signal === 'SIGINT' ? 130 : 143))
      );
    });
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}
const envFiles = [
  resolve(root, '.env'),
  resolve(root, 'apps/backend/.env'),
].filter(existsSync);
if (process.env.ASTRAL_NATIVE_ENV_LOADED !== '1' && envFiles.length)
  process.exit(
    await run(
      process.execPath,
      [
        ...envFiles.map((path) => `--env-file=${path}`),
        process.argv[1],
        ...process.argv.slice(2),
      ],
      { ...process.env, ASTRAL_NATIVE_ENV_LOADED: '1' }
    )
  );
// Local .env files may hold production credentials; dev commands migrate on start, so only loopback is allowed by default.
const command = process.argv[2] ?? 'serve';
const selfGuarded = ['prune:prices', 'explain:search'].includes(command);
if (!selfGuarded && process.env.ASTRAL_ALLOW_REMOTE_DATABASE !== '1') {
  let local = false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    local =
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) &&
      !['host', 'hostaddr', 'port', 'dbname', 'database'].some((key) =>
        url.searchParams.has(key)
      );
  } catch {}
  if (!local) {
    console.error(
      `Refusing \`${command}\`: DATABASE_URL must select loopback PostgreSQL without database routing query overrides. Set ASTRAL_ALLOW_REMOTE_DATABASE=1 to override.`
    );
    process.exit(1);
  }
}
const binary = resolve(root, 'target/debug/astral-grove-server');
if (!existsSync(binary) || process.env.ASTRAL_SKIP_BUILD !== '1') {
  const code = await run('cargo', [
    'build',
    '--package',
    'astral-grove-server',
    '--bin',
    'astral-grove-server',
    '--locked',
  ]);
  if (code !== 0) process.exit(code);
}
process.exit(await run(binary, process.argv.slice(2)));
