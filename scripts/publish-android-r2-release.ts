#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  createClient,
  getArg,
  isProfile,
  type Profile,
  pruneReleaseArtifacts,
  releaseKeys,
} from './lib/internal-release.ts';

function parseArgs(argv: string[]): {
  profile: Profile;
  apkPath: string;
  outDir: string;
} {
  const profile = getArg(argv, '--profile');
  if (!isProfile(profile)) {
    throw new Error(`--profile must be one of: development, preview`);
  }

  const apkPath = getArg(argv, '--apk');
  const outDir = getArg(argv, '--out-dir') ?? process.env.RUNNER_TEMP ?? '/tmp';

  if (!apkPath) {
    throw new Error(
      'Usage: publish-android-r2-release --profile <development|preview> --apk <path> [--out-dir <dir>]'
    );
  }

  return { profile, apkPath, outDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const keys = releaseKeys(args.profile);
  const client = createClient();

  const apkFile = Bun.file(args.apkPath);
  if (!(await apkFile.exists())) {
    throw new Error(`APK not found: ${args.apkPath}`);
  }

  await client.write(keys.apk, apkFile, {
    type: 'application/vnd.android.package-archive',
  });

  const remainingApks = await pruneReleaseArtifacts(
    client,
    '.apk',
    new Set([releaseKeys('development').apk, releaseKeys('preview').apk])
  );

  const result = {
    profile: args.profile,
    platform: 'android',
    artifact: basename(args.apkPath),
    apkKey: keys.apk,
    remainingApks,
  };

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(
    join(args.outDir, 'publish-android.json'),
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main();
}
