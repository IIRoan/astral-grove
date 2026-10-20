import { describe, expect, test } from 'bun:test';
import {
  buildCombinedInstallPage,
  buildItmsInstallUrl,
  buildManifestPlist,
  escapeHtml,
  escapeXml,
  fingerprintKey,
  isProfile,
  releaseKeys,
  resolveBuildPlan,
  resolveUrl,
} from './internal-release.ts';
import { releaseAccessToken } from './internal-release-signing.ts';

describe('internal-release manifest', () => {
  test('escapes & in plist IPA URLs so Apple can parse the manifest', () => {
    const ipaUrl =
      'https://example.r2.cloudflarestorage.com/bucket/app.ipa?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=key';
    const plist = buildManifestPlist({
      ipaUrl,
      bundleId: 'com.iroan.astralgrove.dev',
      bundleVersion: '1',
      title: 'Astral Grove Dev',
    });
    expect(plist).toContain(`<string>${escapeXml(ipaUrl)}</string>`);
    expect(plist.includes('&X-Amz-Credential=')).toBe(false);
  });

  test('itms install url encodes the plist url', () => {
    const installUrl = buildItmsInstallUrl(
      'https://cdn.example/releases/development.plist?sig=1&exp=2'
    );
    expect(installUrl).toContain(
      encodeURIComponent('https://cdn.example/releases/development.plist?sig=1&exp=2')
    );
  });
});

describe('release keys', () => {
  test('maps each profile to stable ipa/apk/plist/page/qr keys', () => {
    expect(releaseKeys('development')).toEqual({
      ipa: 'releases/development.ipa',
      apk: 'releases/development.apk',
      plist: 'releases/development.plist',
      page: 'releases/development.html',
      qr: 'releases/development-qr.png',
    });
    expect(releaseKeys('preview').apk).toBe('releases/preview.apk');
  });

  test('isProfile guards unknown profiles', () => {
    expect(isProfile('development')).toBe(true);
    expect(isProfile('preview')).toBe(true);
    expect(isProfile('production')).toBe(false);
    expect(isProfile(undefined)).toBe(false);
  });
});

describe('combined install page', () => {
  test('shows both iOS install and Android download when both exist', () => {
    const iosInstallUrl = buildItmsInstallUrl(
      'https://cdn.example/releases/development.plist'
    );
    const androidApkUrl = 'https://cdn.example/releases/development.apk';
    const page = buildCombinedInstallPage({
      title: 'Astral Grove Dev',
      profile: 'development',
      iosInstallUrl,
      androidApkUrl,
    });

    expect(page).toContain('<h2>iOS</h2>');
    expect(page).toContain('<h2>Android</h2>');
    expect(page).toContain(`href="${escapeHtml(iosInstallUrl)}"`);
    expect(page).toContain(`href="${escapeHtml(androidApkUrl)}"`);
    expect(page).toContain('Install on iPhone');
    expect(page).toContain('Download for Android');
    expect(page).toContain('download="astral-grove-development.apk"');
    expect(page).toContain('open it from Downloads to install');
  });

  test('renders disabled rows for a platform that has no artifact yet', () => {
    const page = buildCombinedInstallPage({
      title: 'Astral Grove Preview',
      profile: 'preview',
      iosInstallUrl: 'itms-services://?action=download-manifest&url=x',
      androidApkUrl: null,
    });

    expect(page).toContain('Install on iPhone');
    expect(page).toContain('Android build unavailable');
    expect(page).not.toContain('Download for Android');
  });
});

describe('native build plan', () => {
  test('stores fingerprints per profile and platform next to the release artifacts', () => {
    expect(fingerprintKey('preview', 'ios')).toBe('releases/preview-ios.fingerprint');
    expect(fingerprintKey('development', 'android')).toBe(
      'releases/development-android.fingerprint'
    );
  });

  test('skips platforms whose fingerprint matches the last build', () => {
    const plan = resolveBuildPlan(
      {
        ios: { current: 'a', previous: 'a' },
        android: { current: 'b', previous: 'x' },
      },
      false
    );
    expect(plan).toEqual([
      { platform: 'ios', fingerprint: 'a', build: false },
      { platform: 'android', fingerprint: 'b', build: true },
    ]);
  });

  test('builds when no previous fingerprint was recorded', () => {
    const plan = resolveBuildPlan(
      {
        ios: { current: 'a', previous: null },
        android: { current: 'b', previous: null },
      },
      false
    );
    expect(plan.every((d) => d.build)).toBe(true);
  });

  test('force rebuilds even when fingerprints are unchanged', () => {
    const plan = resolveBuildPlan(
      {
        ios: { current: 'a', previous: 'a' },
        android: { current: 'b', previous: 'b' },
      },
      true
    );
    expect(plan.every((d) => d.build)).toBe(true);
  });
});

describe('permanent release URLs', () => {
  test('requires a stable public base rather than falling back to expiring signatures', () => {
    const previous = process.env.S3_PUBLIC_BASE_URL;
    delete process.env.S3_PUBLIC_BASE_URL;
    try {
      expect(() => resolveUrl('releases/preview.html')).toThrow('S3_PUBLIC_BASE_URL');
    } finally {
      if (previous === undefined) delete process.env.S3_PUBLIC_BASE_URL;
      else process.env.S3_PUBLIC_BASE_URL = previous;
    }
  });

  test('uses the same permanent URL for the page, manifest, and APK', () => {
    const previous = process.env.S3_PUBLIC_BASE_URL;
    const previousSecret = process.env.RELEASE_LINK_SECRET;
    process.env.S3_PUBLIC_BASE_URL = 'https://riftapi.solace.onl/api/v1/';
    process.env.RELEASE_LINK_SECRET = 'test-internal-release-secret';
    try {
      for (const key of Object.values(releaseKeys('preview'))) {
        const url = resolveUrl(key);
        expect(url).toBe(
          `https://riftapi.solace.onl/api/v1/${key}?token=${releaseAccessToken('test-internal-release-secret', key)}`
        );
        expect(resolveUrl(key)).toBe(url);
        expect(new URL(url).searchParams.has('X-Amz-Expires')).toBe(false);
      }
    } finally {
      if (previous === undefined) delete process.env.S3_PUBLIC_BASE_URL;
      else process.env.S3_PUBLIC_BASE_URL = previous;
      if (previousSecret === undefined) delete process.env.RELEASE_LINK_SECRET;
      else process.env.RELEASE_LINK_SECRET = previousSecret;
    }
  });

  test('rejects an expiring signed URL supplied as the public base', () => {
    const previous = process.env.S3_PUBLIC_BASE_URL;
    process.env.S3_PUBLIC_BASE_URL =
      'https://storage.example/releases?X-Amz-Expires=604800';
    try {
      expect(() => resolveUrl('releases/preview.html')).toThrow('S3_PUBLIC_BASE_URL');
    } finally {
      if (previous === undefined) delete process.env.S3_PUBLIC_BASE_URL;
      else process.env.S3_PUBLIC_BASE_URL = previous;
    }
  });
});
