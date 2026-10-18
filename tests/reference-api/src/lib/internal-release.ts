export const PROFILES = ['development', 'preview'] as const;
export type Profile = (typeof PROFILES)[number];

export const RELEASE_PREFIX = 'releases/';

export const releaseKeys = (profile: Profile) => ({
  ipa: `${RELEASE_PREFIX}${profile}.ipa`,
  apk: `${RELEASE_PREFIX}${profile}.apk`,
  plist: `${RELEASE_PREFIX}${profile}.plist`,
  page: `${RELEASE_PREFIX}${profile}.html`,
  qr: `${RELEASE_PREFIX}${profile}-qr.png`,
});

export function isProfile(value: string | undefined): value is Profile {
  return value !== undefined && (PROFILES as readonly string[]).includes(value);
}

export function releaseAccessToken(secret: string, key: string): string {
  return createHmac('sha256', secret)
    .update(`astral-grove:internal-release:${key}`)
    .digest('hex');
}

export function hasReleaseAccess(
  secret: string,
  key: string,
  token: string | null
): boolean {
  if (!token || token.length !== 64) return false;
  const expected = Buffer.from(releaseAccessToken(secret, key));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const CONTENT_TYPES = {
  ipa: 'application/octet-stream',
  apk: 'application/vnd.android.package-archive',
  plist: 'application/xml',
  page: 'text/html; charset=utf-8',
  qr: 'image/png',
} as const;

export function releaseFile(filename: string) {
  for (const profile of PROFILES) {
    const keys = releaseKeys(profile);
    for (const kind of ['ipa', 'apk', 'plist', 'page', 'qr'] as const) {
      if (keys[kind] === `${RELEASE_PREFIX}${filename}`) {
        return { key: keys[kind], profile, kind, contentType: CONTENT_TYPES[kind] };
      }
    }
  }
  return null;
}
import { createHmac, timingSafeEqual } from 'node:crypto';
