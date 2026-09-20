#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  buildManifestPlist,
  createClient,
  getArg,
  isProfile,
  type Profile,
  pruneReleaseArtifacts,
  releaseKeys,
  resolveUrl,
} from './lib/internal-release.ts';

function parseArgs(argv: string[]): {
  profile: Profile;
  ipaPath: string;
  bundleId: string;
  bundleVersion: string;
  title: string;
  outDir: string;
} {
  const profile = getArg(argv, '--profile');
  if (!isProfile(profile)) {
    throw new Error(`--profile must be one of: development, preview`);
  }

  const ipaPath = getArg(argv, '--ipa');
  const bundleId = getArg(argv, '--bundle-id');
  const bundleVersion = getArg(argv, '--bundle-version');
  const title = getArg(argv, '--title');
  const outDir = getArg(argv, '--out-dir') ?? process.env.RUNNER_TEMP ?? '/tmp';

  if (!ipaPath || !bundleId || !bundleVersion || !title) {
    throw new Error(
      'Usage: publish-ios-r2-release --profile <development|preview> --ipa <path> --bundle-id <id> --bundle-version <v> --title <title> [--out-dir <dir>]'
    );
  }

  return { profile, ipaPath, bundleId, bundleVersion, title, outDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const keys = releaseKeys(args.profile);
  const client = createClient();

  const ipaFile = Bun.file(args.ipaPath);
  if (!(await ipaFile.exists())) {
    throw new Error(`IPA not found: ${args.ipaPath}`);
  }

  await client.write(keys.ipa, ipaFile, { type: 'application/octet-stream' });

  const ipaUrl = resolveUrl(client, keys.ipa);
  const plistBody = buildManifestPlist({
    ipaUrl,
    bundleId: args.bundleId,
    bundleVersion: args.bundleVersion,
    title: args.title,
  });

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(join(args.outDir, `${args.profile}.plist`), plistBody, 'utf8');
  await client.write(keys.plist, plistBody, { type: 'application/xml' });

  const remainingIpas = await pruneReleaseArtifacts(
    client,
    '.ipa',
    new Set([releaseKeys('development').ipa, releaseKeys('preview').ipa])
  );

  const result = {
    profile: args.profile,
    platform: 'ios',
    artifact: basename(args.ipaPath),
    ipaKey: keys.ipa,
    plistKey: keys.plist,
    remainingIpas,
  };

  writeFileSync(join(args.outDir, 'publish-ios.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main();
}
