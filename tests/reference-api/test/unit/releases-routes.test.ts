import { describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { releaseAccessToken } from '../../src/lib/internal-release.js';
import {
  createReleasesRoutes,
  type ReleaseStorage,
} from '../../src/routes/releases.js';

const ACCESS_SECRET = 'test-internal-release-secret';

function setup() {
  const objects = new Map([
    ['releases/preview.html', '<html>latest preview</html>'],
    ['releases/preview.plist', '<plist>latest manifest</plist>'],
    ['releases/preview.apk', 'APK'],
    ['releases/preview.ipa', 'IPA'],
    ['releases/preview-qr.png', 'PNG'],
  ]);
  const storage = {
    exists: mock(async (key: string) => objects.has(key)),
    file: (key: string) => ({ text: async () => objects.get(key) ?? '' }),
    presign: mock((key, options) => {
      const url = new URL(`https://storage.example/${key}`);
      url.searchParams.set('response-content-type', options.type ?? '');
      url.searchParams.set(
        'response-content-disposition',
        options.contentDisposition ?? ''
      );
      return url.href;
    }),
  } satisfies ReleaseStorage;
  const app = new Elysia().use(createReleasesRoutes(storage, ACCESS_SECRET));
  return { app, storage, objects };
}

function request(
  app: Pick<Elysia, 'handle'>,
  filename: string,
  method = 'GET',
  token = releaseAccessToken(ACCESS_SECRET, `releases/${filename}`)
) {
  return app.handle(
    new Request(`https://api.example/api/v1/releases/${filename}?token=${token}`, {
      method,
    })
  );
}

describe('permanent internal release downloads', () => {
  test('serves the install page at its permanent address without caching an expiring redirect', async () => {
    const { app, storage } = setup();
    const response = await request(app, 'preview.html');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).toBe('<html>latest preview</html>');
    expect(storage.presign).not.toHaveBeenCalled();
  });

  test('reads the latest manifest every time, including after an artifact is replaced', async () => {
    const { app, storage, objects } = setup();
    const first = await request(app, 'preview.plist');
    expect(first.headers.get('content-type')).toBe('application/xml');
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.text()).toBe('<plist>latest manifest</plist>');
    objects.set('releases/preview.plist', '<plist>new manifest</plist>');
    const next = await request(app, 'preview.plist');
    expect(await next.text()).toBe('<plist>new manifest</plist>');
    expect(storage.presign).not.toHaveBeenCalled();
  });

  test.each([
    ['apk', 'application/vnd.android.package-archive'],
    ['ipa', 'application/octet-stream'],
  ])(
    'mints a fresh %s download with a real filename on each request',
    async (extension, type) => {
      const { app, storage } = setup();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await request(app, `preview.${extension}`);
        expect(response.status).toBe(302);
        expect(response.headers.get('cache-control')).toBe('no-store');
        const url = new URL(response.headers.get('location')!);
        expect(url.pathname).toBe(`/releases/preview.${extension}`);
        expect(url.searchParams.get('response-content-type')).toBe(type);
        expect(url.searchParams.get('response-content-disposition')).toBe(
          `attachment; filename="astral-grove-preview.${extension}"`
        );
      }
      expect(storage.presign).toHaveBeenCalledTimes(2);
      expect(storage.presign).toHaveBeenLastCalledWith(
        `releases/preview.${extension}`,
        {
          expiresIn: 3600,
          method: 'GET',
          type,
          contentDisposition: `attachment; filename="astral-grove-preview.${extension}"`,
        }
      );
    }
  );

  test('uses a HEAD signature when a download manager checks the file first', async () => {
    const { app, storage } = setup();
    const response = await request(app, 'preview.apk', 'HEAD');
    expect(response.status).toBe(302);
    expect(storage.presign.mock.lastCall?.[1]?.method).toBe('HEAD');
  });

  test.each([
    'preview-android.fingerprint',
    'preview-ios.fingerprint',
    'production.apk',
    'private.json',
    'preview.apk/extra',
    '%2e%2e%2fprivate.json',
  ])('never exposes non-release objects: %s', async (filename) => {
    const { app, storage } = setup();
    const response = await request(app, filename);
    expect(response.status).toBe(404);
    expect(storage.exists).not.toHaveBeenCalled();
    expect(storage.presign).not.toHaveBeenCalled();
  });

  test('returns 404 for missing artifacts and unconfigured storage', async () => {
    const { app } = setup();
    const missing = await request(app, 'development.apk');
    expect(missing.status).toBe(404);
    const unconfigured = new Elysia().use(createReleasesRoutes(null));
    const response = await request(unconfigured, 'preview.apk');
    expect(response.status).toBe(404);
  });

  test.each(['', 'invalid', '0'.repeat(64)])(
    'rejects missing or invalid access tokens without contacting storage',
    async (token) => {
      const { app, storage } = setup();
      const response = await request(app, 'preview.apk', 'GET', token);
      expect(response.status).toBe(404);
      expect(storage.exists).not.toHaveBeenCalled();
      expect(storage.presign).not.toHaveBeenCalled();
    }
  );

  test('cannot reuse a page token to fetch a different release file', async () => {
    const { app, storage } = setup();
    const token = releaseAccessToken(ACCESS_SECRET, 'releases/preview.html');
    const response = await request(app, 'preview.apk', 'GET', token);
    expect(response.status).toBe(404);
    expect(storage.exists).not.toHaveBeenCalled();
  });
});
