#!/usr/bin/env bun
import { S3Client } from 'bun';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const PROFILES = ['development', 'preview'] as const;
type Profile = (typeof PROFILES)[number];

const RELEASE_PREFIX = 'releases/';
const IPA_KEYS = {
  development: `${RELEASE_PREFIX}development.ipa`,
  preview: `${RELEASE_PREFIX}preview.ipa`,
} as const;
const ALLOWED_IPA_KEYS = new Set<string>(Object.values(IPA_KEYS));

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

export function buildInstallPage(input: {
  title: string;
  profile: string;
  installUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
</head>
<body>
<h1>${escapeHtml(input.title)}</h1>
<p>${escapeHtml(input.profile)} · open on your iPhone, then tap Install.</p>
<p><a href="${escapeHtml(input.installUrl)}">Install</a></p>
</body>
</html>
`;
}

export function buildItmsInstallUrl(plistUrl: string): string {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

function parseArgs(argv: string[]): {
  profile: Profile;
  ipaPath: string;
  bundleId: string;
  bundleVersion: string;
  title: string;
  outDir: string;
} {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index === -1) return undefined;
    return argv[index + 1];
  };

  const profile = get('--profile');
  if (!profile || !PROFILES.includes(profile as Profile)) {
    throw new Error(`--profile must be one of: ${PROFILES.join(', ')}`);
  }

  const ipaPath = get('--ipa');
  const bundleId = get('--bundle-id');
  const bundleVersion = get('--bundle-version');
  const title = get('--title');
  const outDir = get('--out-dir') ?? process.env.RUNNER_TEMP ?? '/tmp';

  if (!ipaPath || !bundleId || !bundleVersion || !title) {
    throw new Error(
      'Usage: publish-ios-r2-release --profile <development|preview> --ipa <path> --bundle-id <id> --bundle-version <v> --title <title> [--out-dir <dir>]'
    );
  }

  return {
    profile: profile as Profile,
    ipaPath,
    bundleId,
    bundleVersion,
    title,
    outDir,
  };
}

function publicBaseUrl(): string | null {
  const raw = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

function objectUrl(base: string, key: string): string {
  return `${base}/${key.replace(/^\//, '')}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ipaKey = IPA_KEYS[args.profile];
  const plistKey = `${RELEASE_PREFIX}${args.profile}.plist`;
  const pageKey = `${RELEASE_PREFIX}${args.profile}.html`;
  const qrKey = `${RELEASE_PREFIX}${args.profile}-qr.png`;

  const client = new S3Client({
    accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY'),
    bucket: requiredEnv('S3_BUCKET'),
    endpoint: requiredEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION?.trim() || 'auto',
  });

  const ipaFile = Bun.file(args.ipaPath);
  if (!(await ipaFile.exists())) {
    throw new Error(`IPA not found: ${args.ipaPath}`);
  }

  await client.write(ipaKey, ipaFile, { type: 'application/octet-stream' });

  const publicBase = publicBaseUrl();
  const resolveUrl = (key: string) =>
    publicBase
      ? objectUrl(publicBase, key)
      : client.presign(key, { expiresIn: 60 * 60 * 24 * 7, method: 'GET' });

  const ipaUrl = resolveUrl(ipaKey);

  const plistBody = buildManifestPlist({
    ipaUrl,
    bundleId: args.bundleId,
    bundleVersion: args.bundleVersion,
    title: args.title,
  });

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(join(args.outDir, `${args.profile}.plist`), plistBody, 'utf8');
  await client.write(plistKey, plistBody, { type: 'application/xml' });

  const plistUrl = resolveUrl(plistKey);
  const installUrl = buildItmsInstallUrl(plistUrl);

  const pageBody = buildInstallPage({
    title: args.title,
    profile: args.profile,
    installUrl,
  });
  writeFileSync(join(args.outDir, `${args.profile}.html`), pageBody, 'utf8');
  await client.write(pageKey, pageBody, { type: 'text/html; charset=utf-8' });

  const pageUrl = resolveUrl(pageKey);
  const qrPath = join(args.outDir, `${args.profile}-qr.png`);
  const qrProc = Bun.spawn(['bunx', 'qrcode', '-o', qrPath, '-w', '512', pageUrl], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const qrCode = await qrProc.exited;
  if (qrCode !== 0) {
    throw new Error(`qrcode exited ${String(qrCode)}`);
  }

  await client.write(qrKey, Bun.file(qrPath), { type: 'image/png' });

  const listed = await client.list({ prefix: RELEASE_PREFIX });
  const contents = listed.contents ?? [];
  for (const entry of contents) {
    const key = entry.key;
    if (!key?.endsWith('.ipa')) continue;
    if (ALLOWED_IPA_KEYS.has(key)) continue;
    await client.delete(key);
    console.log(`Deleted extra IPA ${key}`);
  }

  const remainingIpas = (await client.list({ prefix: RELEASE_PREFIX })).contents
    ?.map((entry) => entry.key)
    .filter((key): key is string => Boolean(key?.endsWith('.ipa')))
    .sort();
  if ((remainingIpas?.length ?? 0) > 2) {
    throw new Error(
      `Expected at most 2 IPAs under ${RELEASE_PREFIX}, found ${remainingIpas?.join(', ')}`
    );
  }

  const result = {
    profile: args.profile,
    ipa: basename(args.ipaPath),
    ipaKey,
    plistKey,
    pageKey,
    qrKey,
    remainingIpas,
    public: Boolean(publicBase),
  };

  writeFileSync(join(args.outDir, 'publish.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main();
}
