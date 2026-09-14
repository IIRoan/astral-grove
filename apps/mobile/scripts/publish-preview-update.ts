import {
  parseEasJsonArray,
  PreviewUpdateTargetError,
  resolvePreviewUpdateTargets,
  type EasBuildListItem,
} from '../lib/eas-preview-update-targets';

function main(): void {
  const message = parseMessage(process.argv.slice(2));
  const listed = run(
    [
      'eas',
      'build:list',
      '--build-profile',
      'preview',
      '--status',
      'finished',
      '--platform',
      'all',
      '--limit',
      '50',
      '--json',
      '--non-interactive',
    ],
    process.env
  );
  const builds = parseEasJsonArray(listed) as EasBuildListItem[];
  const targets = resolvePreviewUpdateTargets(builds);

  for (const target of targets) {
    console.log(
      `Publishing preview ${target.platform} update for build ${target.buildId} runtime ${target.runtimeVersion}`
    );
    run(
      [
        'eas',
        'update',
        '--branch',
        'preview',
        '--environment',
        'preview',
        '--platform',
        target.platform,
        '--message',
        message,
        '--non-interactive',
      ],
      {
        ...process.env,
        APP_VARIANT: 'preview',
        EAS_UPDATE_RUNTIME_VERSION: target.runtimeVersion,
      }
    );
  }
}

function parseMessage(argv: string[]): string {
  const flag = argv.indexOf('--message');
  const value = flag >= 0 ? argv[flag + 1] : undefined;
  if (!value?.trim()) {
    throw new PreviewUpdateTargetError(
      'Missing --message for the preview EAS update'
    );
  }
  return value;
}

function run(
  command: string[],
  env: Record<string, string | undefined>
): string {
  const result = Bun.spawnSync(command, {
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (result.exitCode !== 0) {
    throw new PreviewUpdateTargetError(
      `${command.join(' ')} failed with exit ${String(result.exitCode ?? 1)}`
    );
  }
  return stdout;
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Failed to publish preview update';
  console.error(message);
  process.exit(1);
}
