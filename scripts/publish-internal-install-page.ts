#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildCombinedInstallPage,
  buildItmsInstallUrl,
  createClient,
  getArg,
  isProfile,
  type Profile,
  releaseKeys,
  resolveUrl,
} from './lib/internal-release.ts';

function parseArgs(argv: string[]): {
  profile: Profile;
  title: string;
  outDir: string;
} {
  const profile = getArg(argv, '--profile');
  if (!isProfile(profile)) {
    throw new Error(`--profile must be one of: development, preview`);
  }

  const title = getArg(argv, '--title');
  const outDir = getArg(argv, '--out-dir') ?? process.env.RUNNER_TEMP ?? '/tmp';

  if (!title) {
    throw new Error(
      'Usage: publish-internal-install-page --profile <development|preview> --title <title> [--out-dir <dir>]'
    );
  }

  return { profile, title, outDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const keys = releaseKeys(args.profile);
  const client = createClient();

  const [hasPlist, hasApk] = await Promise.all([
    client.exists(keys.plist),
    client.exists(keys.apk),
  ]);

  const iosInstallUrl = hasPlist
    ? buildItmsInstallUrl(resolveUrl(client, keys.plist))
    : null;
  const androidApkUrl = hasApk ? resolveUrl(client, keys.apk) : null;

  if (!iosInstallUrl && !androidApkUrl) {
    throw new Error(
      `No installable artifacts found for ${args.profile}; expected ${keys.plist} or ${keys.apk}`
    );
  }

  const pageBody = buildCombinedInstallPage({
    title: args.title,
    profile: args.profile,
    iosInstallUrl,
    androidApkUrl,
  });

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(join(args.outDir, `${args.profile}.html`), pageBody, 'utf8');
  await client.write(keys.page, pageBody, { type: 'text/html; charset=utf-8' });

  const pageUrl = resolveUrl(client, keys.page);
  const qrPath = join(args.outDir, `${args.profile}-qr.png`);
  const qrProc = Bun.spawn(['bunx', 'qrcode', '-o', qrPath, '-w', '512', pageUrl], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const qrCode = await qrProc.exited;
  if (qrCode !== 0) {
    throw new Error(`qrcode exited ${String(qrCode)}`);
  }

  await client.write(keys.qr, Bun.file(qrPath), { type: 'image/png' });

  const result = {
    profile: args.profile,
    pageKey: keys.page,
    pageUrl,
    qrKey: keys.qr,
    qrPath,
    ios: Boolean(iosInstallUrl),
    android: Boolean(androidApkUrl),
  };

  writeFileSync(
    join(args.outDir, 'publish-page.json'),
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main();
}
