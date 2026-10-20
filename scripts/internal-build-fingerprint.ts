#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createClient,
  fingerprintKey,
  getArg,
  isProfile,
  PLATFORMS,
  type Platform,
  type Profile,
  resolveBuildPlan,
} from './lib/internal-release.ts';

const MOBILE_DIR = join(import.meta.dir, '..', 'apps', 'mobile');

function isPlatform(value: string | undefined): value is Platform {
  return value !== undefined && (PLATFORMS as readonly string[]).includes(value);
}

function resolveRuntimeVersion(profile: Profile, platform: Platform): string {
  const result = Bun.spawnSync(
    ['npx', 'expo-updates', 'runtimeversion:resolve', '--platform', platform],
    {
      cwd: MOBILE_DIR,
      // Build profiles and APP_VARIANT values share names (see eas.json).
      env: { ...process.env, APP_VARIANT: profile },
      stdout: 'pipe',
      stderr: 'inherit',
    }
  );
  if (result.exitCode !== 0) {
    throw new Error(`runtimeversion:resolve failed for ${platform}`);
  }
  const line = result.stdout
    .toString()
    .split('\n')
    .findLast((l) => l.trim().startsWith('{'));
  const parsed: unknown = line ? JSON.parse(line) : null;
  const version =
    parsed && typeof parsed === 'object' && 'runtimeVersion' in parsed
      ? parsed.runtimeVersion
      : null;
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error(`Could not resolve ${platform} runtime version`);
  }
  return version.trim();
}

function writeOutputs(outputs: string[]): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, `${outputs.join('\n')}\n`);
}

// Runs the app toolchain, so it must not see storage credentials.
function resolve(profile: Profile): void {
  const outputs = PLATFORMS.map((platform) => {
    const fingerprint = resolveRuntimeVersion(profile, platform);
    console.log(`${platform}: ${fingerprint}`);
    return `${platform}_fingerprint=${fingerprint}`;
  });
  writeOutputs(outputs);
}

// Reads stored fingerprints only; runs without installed dependencies.
async function check(argv: string[], profile: Profile): Promise<void> {
  const force = argv.includes('--force');
  const client = createClient();

  const fingerprints = {} as Record<
    Platform,
    { current: string; previous: string | null }
  >;
  for (const platform of PLATFORMS) {
    const current = getArg(argv, `--${platform}-fingerprint`)?.trim();
    if (!current) {
      throw new Error(`Missing --${platform}-fingerprint`);
    }
    const stored = client.file(fingerprintKey(profile, platform));
    const previous = (await stored.exists()) ? (await stored.text()).trim() : null;
    fingerprints[platform] = { current, previous: previous || null };
  }

  const plan = resolveBuildPlan(fingerprints, force);
  const outputs: string[] = [];
  for (const decision of plan) {
    const { previous } = fingerprints[decision.platform];
    console.log(
      `${decision.platform}: ${decision.fingerprint} (last build ${previous ?? 'none'}) → ${decision.build ? 'build' : 'skip'}`
    );
    outputs.push(`build_${decision.platform}=${String(decision.build)}`);
  }
  writeOutputs(outputs);
}

async function record(argv: string[], profile: Profile): Promise<void> {
  const platform = getArg(argv, '--platform');
  const fingerprint = getArg(argv, '--fingerprint')?.trim();
  if (!isPlatform(platform) || !fingerprint) {
    throw new Error(
      'Usage: internal-build-fingerprint record --profile <profile> --platform <ios|android> --fingerprint <hash>'
    );
  }
  await createClient().write(fingerprintKey(profile, platform), fingerprint, {
    type: 'text/plain',
  });
  console.log(`Recorded ${profile} ${platform} fingerprint ${fingerprint}`);
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  const profile = getArg(argv, '--profile');
  if (!isProfile(profile)) {
    throw new Error('--profile must be one of: development, preview');
  }
  if (command === 'resolve') return resolve(profile);
  if (command === 'check') return check(argv, profile);
  if (command === 'record') return record(argv, profile);
  throw new Error(
    'Usage: internal-build-fingerprint <resolve|check|record> --profile <profile>'
  );
}

if (import.meta.main) {
  await main();
}
