import { expect, test } from 'bun:test';
import { createHarness, json } from '../apps/backend/test/support';
import { startJmapFixture } from '../apps/backend/test/fixtures/jmap';
import { startOfflineUpstream } from '../apps/backend/test/fixtures/offline';
import { resolve } from 'node:path';
import { buildCombinedInstallPage } from './lib/internal-release';
import { releaseAccessToken } from './lib/internal-release-signing';

test('isolated browser regression suite', async () => {
  const harness = createHarness();
  const offline = startOfflineUpstream();
  const mail = startJmapFixture();
  const releaseObjects = new Map<string, { body: string; type: string }>();
  const storage = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      const object = releaseObjects.get(url.pathname.replace(/^\/fixture\//, ''));
      if (!object) return new Response(null, { status: 404 });
      return new Response(request.method === 'HEAD' ? null : object.body, {
        headers: {
          'content-type': url.searchParams.get('response-content-type') ?? object.type,
          ...(url.searchParams.has('response-content-disposition')
            ? {
                'content-disposition': url.searchParams.get(
                  'response-content-disposition'
                )!,
              }
            : {}),
        },
      });
    },
  });
  const releaseSecret = 'synthetic-browser-release-signing-key';
  const started = new Date();
  const listener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { data() {} },
  });
  const webPort = listener.port;
  listener.stop(true);
  const web = `http://localhost:${webPort}`;
  const common = {
    PA_BASE_URL: offline.url,
    IMAGE_CDN_BASE_URL: offline.url + '/cdn',
    PUBLIC_APP_URL: web,
    TRUSTED_ORIGINS: web,
    RELEASE_S3_ENDPOINT: storage.url.origin,
    RELEASE_S3_REGION: 'auto',
    RELEASE_S3_BUCKET: 'fixture',
    RELEASE_S3_ACCESS_KEY_ID: 'fixture',
    RELEASE_S3_SECRET_ACCESS_KEY: 'fixture-storage-key',
    RELEASE_LINK_SECRET: releaseSecret,
  };
  const fixture = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const email = new URL(request.url).searchParams.get('email') ?? '';
      if (!email.startsWith('security-ui-') || !email.endsWith('@test.riftbound.dev'))
        return new Response(null, { status: 400 });
      const messages = mail.messages.filter((message) =>
        JSON.stringify(message.to).includes(email)
      );
      return Response.json(messages);
    },
  });
  let child: ReturnType<typeof Bun.spawn> | undefined;
  try {
    const app = await harness.startServer(common);
    const releaseUrl = (filename: string) =>
      `${app.origin}/api/v1/releases/${filename}?token=${releaseAccessToken(releaseSecret, `releases/${filename}`)}`;
    releaseObjects.set('releases/preview.apk', {
      body: 'synthetic-browser-apk',
      type: 'application/vnd.android.package-archive',
    });
    releaseObjects.set('releases/preview.html', {
      body:
        buildCombinedInstallPage({
          title: 'Fixture install',
          profile: 'preview',
          iosInstallUrl: null,
          androidApkUrl: releaseUrl('preview.apk'),
        }) + '<script>document.documentElement.dataset.executed="yes"</script>',
      type: 'text/html',
    });
    const auth = await harness.startServer({
      ...common,
      STALWART_JMAP_URL: mail.url,
      STALWART_JMAP_USERNAME: 'fixture',
      STALWART_JMAP_PASSWORD: 'fixture',
      EMAIL_FROM: 'noreply@test.riftbound.dev',
    });
    // Fail early if the fixture accidentally permits an invalid protected mutation.
    expect(
      (await app.fetch('/api/v1/collection/import', json({ csv: 'invalid' }))).status
    ).toBe(401);
    child = Bun.spawn(
      [
        process.execPath,
        '--no-env-file',
        'x',
        '--no-install',
        'playwright',
        'test',
        ...(process.env.UI_E2E_SPECS?.split(',') ?? [
          'security.spec.ts',
          'auth.spec.ts',
          'collection.spec.ts',
          'catalog-ownership-prices.spec.ts',
          'decks.spec.ts',
          'settings-share.spec.ts',
        ]),
      ],
      {
        cwd: resolve(import.meta.dir, '../apps/mobile'),
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          CI: '1',
          NODE_ENV: 'development',
          BUN_RESOURCE_LIMITED: '1',
          EXPO_NO_DOTENV: '1',
          EXPO_PUBLIC_API_URL: app.origin,
          EXPO_PUBLIC_APP_URL: web,
          UI_E2E_API_URL: app.origin,
          UI_E2E_AUTH_API_URL: auth.origin,
          UI_E2E_FIXTURE_URL: fixture.url.origin,
          UI_E2E_RELEASE_URL: releaseUrl('preview.html'),
          UI_E2E_WEB_PORT: String(webPort),
          UI_E2E_WEB_URL: web,
          EXPO_OFFLINE: '1',
          EXPO_NO_TELEMETRY: '1',
        },
        stdout: 'inherit',
        stderr: 'inherit',
      }
    );
    expect(await child.exited).toBe(0);
  } finally {
    child?.kill('SIGTERM');
    fixture.stop(true);
    storage.stop(true);
    mail.stop();
    offline.stop();
    const users =
      await harness.sql`SELECT id,email FROM "user" WHERE created_at>=${started} AND (email LIKE 'ui-e2e-%@test.riftbound.dev' OR email LIKE 'security-ui-%@test.riftbound.dev')`;
    for (const user of users) {
      await harness.sql`DELETE FROM verification WHERE identifier LIKE ${`%${user.email}%`} OR value=${user.id}`;
      await harness.sql`DELETE FROM "user" WHERE id=${user.id}`;
    }
    await harness.stopServer();
  }
}, 1800000);
