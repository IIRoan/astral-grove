import { describe, expect, test } from 'bun:test';
import {
  buildInstallPage,
  buildItmsInstallUrl,
  buildManifestPlist,
  escapeHtml,
  escapeXml,
} from './publish-ios-r2-release.ts';

describe('publish-ios-r2-release', () => {
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

  test('install page links itms-services for a Safari tap', () => {
    const installUrl = buildItmsInstallUrl(
      'https://cdn.example/releases/development.plist?sig=1&exp=2'
    );
    expect(installUrl).toContain(
      encodeURIComponent('https://cdn.example/releases/development.plist?sig=1&exp=2')
    );

    const page = buildInstallPage({
      title: 'Astral Grove Dev',
      profile: 'development',
      installUrl,
    });
    expect(page).toContain(`href="${escapeHtml(installUrl)}"`);
    expect(page).toContain('Install');
  });
});
