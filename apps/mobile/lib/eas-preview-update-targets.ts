export class PreviewUpdateTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreviewUpdateTargetError';
  }
}

export type EasBuildListItem = {
  id?: string;
  platform?: string;
  status?: string;
  buildProfile?: string;
  completedAt?: string | null;
  createdAt?: string | null;
  isForIosSimulator?: boolean;
  runtime?: { version?: string | null } | null;
  fingerprint?: { hash?: string | null } | null;
};

export type PreviewUpdateTarget = {
  platform: 'ios' | 'android';
  runtimeVersion: string;
  buildId: string;
};

const PREVIEW_PROFILE = 'preview';
const FINISHED_STATUS = 'finished';

export function parseEasJsonArray(stdout: string): unknown[] {
  const start = stdout.indexOf('[');
  if (start < 0) {
    throw new PreviewUpdateTargetError('eas build:list did not return a JSON array');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.slice(start));
  } catch {
    throw new PreviewUpdateTargetError('eas build:list returned invalid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new PreviewUpdateTargetError('eas build:list JSON was not an array');
  }
  return parsed;
}

export function resolvePreviewUpdateTargets(
  builds: readonly EasBuildListItem[]
): PreviewUpdateTarget[] {
  const latest = new Map<'ios' | 'android', { build: EasBuildListItem; at: number }>();

  for (const build of builds) {
    if (!isFinishedPreviewDeviceBuild(build)) continue;
    const platform = parsePlatform(build.platform);
    if (!platform) continue;
    const at = buildTimestamp(build);
    const current = latest.get(platform);
    if (!current || at > current.at) {
      latest.set(platform, { build, at });
    }
  }

  const targets: PreviewUpdateTarget[] = [];
  for (const platform of ['ios', 'android'] as const) {
    const selected = latest.get(platform);
    if (!selected) continue;
    const runtimeVersion = runtimeVersionOf(selected.build);
    if (!runtimeVersion) {
      throw new PreviewUpdateTargetError(
        `Latest preview ${platform} build is missing a runtime version`
      );
    }
    const buildId = selected.build.id?.trim();
    if (!buildId) {
      throw new PreviewUpdateTargetError(
        `Latest preview ${platform} build is missing an id`
      );
    }
    targets.push({ platform, runtimeVersion, buildId });
  }

  if (targets.length === 0) {
    throw new PreviewUpdateTargetError(
      'No finished preview EAS build found; refusing to publish a preview update'
    );
  }

  return targets;
}

function isFinishedPreviewDeviceBuild(build: EasBuildListItem): boolean {
  if (build.buildProfile !== PREVIEW_PROFILE) return false;
  if (build.status?.trim().toLowerCase() !== FINISHED_STATUS) return false;
  if (build.isForIosSimulator) return false;
  return true;
}

function parsePlatform(value: string | undefined): 'ios' | 'android' | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'ios' || normalized === 'android') return normalized;
  return null;
}

function runtimeVersionOf(build: EasBuildListItem): string | null {
  const version = build.runtime?.version?.trim() || build.fingerprint?.hash?.trim();
  return version || null;
}

function buildTimestamp(build: EasBuildListItem): number {
  const raw = build.completedAt ?? build.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}
