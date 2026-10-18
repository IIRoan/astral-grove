import { S3Client } from 'bun';
import {
  PROFILES,
  type Profile,
  RELEASE_PREFIX,
  releaseAccessToken,
} from './internal-release-signing.ts';
export {
  isProfile,
  PROFILES,
  type Profile,
  RELEASE_PREFIX,
  releaseKeys,
} from './internal-release-signing.ts';

export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const fingerprintKey = (profile: Profile, platform: Platform) =>
  `${RELEASE_PREFIX}${profile}-${platform}.fingerprint`;

export type BuildDecision = { platform: Platform; fingerprint: string; build: boolean };

// A platform rebuilds only when its native fingerprint differs from the last published build.
export function resolveBuildPlan(
  fingerprints: Record<Platform, { current: string; previous: string | null }>,
  force: boolean
): BuildDecision[] {
  return PLATFORMS.map((platform) => {
    const { current, previous } = fingerprints[platform];
    return { platform, fingerprint: current, build: force || current !== previous };
  });
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildManifestPlist(input: {
  ipaUrl: string;
  bundleId: string;
  bundleVersion: string;
  title: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>items</key>
    <array>
      <dict>
        <key>assets</key>
        <array>
          <dict>
            <key>kind</key><string>software-package</string>
            <key>url</key><string>${escapeXml(input.ipaUrl)}</string>
          </dict>
        </array>
        <key>metadata</key>
        <dict>
          <key>bundle-identifier</key><string>${escapeXml(input.bundleId)}</string>
          <key>bundle-version</key><string>${escapeXml(input.bundleVersion)}</string>
          <key>kind</key><string>software</string>
          <key>title</key><string>${escapeXml(input.title)}</string>
        </dict>
      </dict>
    </array>
  </dict>
</plist>
`;
}

export function buildItmsInstallUrl(plistUrl: string): string {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;
}

// Single QR install page that offers both the iOS ad-hoc install and the Android APK download.
// A missing URL renders a disabled row so the page never links to a half-built release.
export function buildCombinedInstallPage(input: {
  title: string;
  profile: string;
  iosInstallUrl: string | null;
  androidApkUrl: string | null;
}): string {
  const iosBlock = input.iosInstallUrl
    ? `<a class="btn" href="${escapeHtml(input.iosInstallUrl)}">Install on iPhone</a>
        <p class="hint">Open this page in Safari, then tap Install. Your device must be registered ad-hoc.</p>`
    : `<span class="btn btn-disabled" aria-disabled="true">iOS build unavailable</span>`;

  const androidBlock = input.androidApkUrl
    ? `<a class="btn" href="${escapeHtml(input.androidApkUrl)}" download="astral-grove-${escapeHtml(input.profile)}.apk">Download for Android</a>
        <p class="hint">Open this page in Chrome or your phone's browser. Download the APK, then open it from Downloads to install. Allow installs from this browser if prompted.</p>`
    : `<span class="btn btn-disabled" aria-disabled="true">Android build unavailable</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #121212; color: #f5f5f4; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
  main { width: 100%; max-width: 420px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  .profile { color: #a3a3a3; margin: 0 0 24px; text-transform: capitalize; }
  .platform { border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #181818; }
  .platform h2 { font-size: 1rem; margin: 0 0 12px; }
  .btn { display: block; text-align: center; text-decoration: none; padding: 12px 16px; border-radius: 8px;
    background: #f5f5f4; color: #121212; font-weight: 600; }
  .btn-disabled { background: #2a2a2a; color: #6b6b6b; }
  .hint { color: #a3a3a3; font-size: 0.85rem; margin: 12px 0 0; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(input.title)}</h1>
  <p class="profile">${escapeHtml(input.profile)} build</p>
  <section class="platform">
    <h2>iOS</h2>
    ${iosBlock}
  </section>
  <section class="platform">
    <h2>Android</h2>
    ${androidBlock}
  </section>
</main>
</body>
</html>
`;
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

export function publicBaseUrl(): string {
  const raw = requiredEnv('S3_PUBLIC_BASE_URL');
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (
    !url ||
    url.protocol !== 'https:' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'S3_PUBLIC_BASE_URL must be a permanent HTTPS base URL without credentials, query parameters, or a fragment'
    );
  }
  return raw.replace(/\/+$/, '');
}

export function objectUrl(base: string, key: string): string {
  return `${base}/${key.replace(/^\//, '')}`;
}

export function createClient(): S3Client {
  return new S3Client({
    accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY'),
    bucket: requiredEnv('S3_BUCKET'),
    endpoint: requiredEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION?.trim() || 'auto',
  });
}

// Stored pages, manifests, and QR codes must only contain permanent URLs.
export function resolveUrl(key: string): string {
  const url = new URL(objectUrl(publicBaseUrl(), key));
  url.searchParams.set(
    'token',
    releaseAccessToken(requiredEnv('S3_SECRET_ACCESS_KEY'), key)
  );
  return url.href;
}

export function getArg(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

// Keeps at most one artifact per profile under releases/ for a given extension.
export async function pruneReleaseArtifacts(
  client: S3Client,
  extension: string,
  allowedKeys: Set<string>
): Promise<string[]> {
  const listed = await client.list({ prefix: RELEASE_PREFIX });
  for (const entry of listed.contents ?? []) {
    const key = entry.key;
    if (!key?.endsWith(extension)) continue;
    if (allowedKeys.has(key)) continue;
    await client.delete(key);
    console.log(`Deleted extra artifact ${key}`);
  }

  const remaining = (await client.list({ prefix: RELEASE_PREFIX })).contents
    ?.map((entry) => entry.key)
    .filter((key): key is string => Boolean(key?.endsWith(extension)))
    .sort();

  if ((remaining?.length ?? 0) > PROFILES.length) {
    throw new Error(
      `Expected at most ${PROFILES.length} ${extension} artifacts under ${RELEASE_PREFIX}, found ${remaining?.join(', ')}`
    );
  }

  return remaining ?? [];
}
