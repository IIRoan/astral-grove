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
  resolve(root, 'apps/api/.env'),
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
