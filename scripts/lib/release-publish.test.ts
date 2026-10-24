import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { releaseAccessToken } from './internal-release-signing';

test('the release publisher builds and uploads HTML and a PNG using installed dependencies only', async () => {
  const objects = new Map<string, { body: Uint8Array; type: string }>();
  objects.set('/releases/preview.apk', {
    body: new TextEncoder().encode('synthetic apk'),
    type: 'application/octet-stream',
  });
  const storage = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      if (!request.headers.get('authorization')?.includes('Credential=fixture-access/'))
        return new Response(null, { status: 403 });
      const key = new URL(request.url).pathname.replace(/^\/fixture-bucket/, '');
      if (request.method === 'PUT') {
        objects.set(key, {
          body: new Uint8Array(await request.arrayBuffer()),
          type: request.headers.get('content-type') ?? '',
        });
        return new Response(null, { status: 200 });
      }
      const object = objects.get(key);
      return new Response(null, {
        status: object ? 200 : 404,
        headers: { 'content-length': String(object?.body.length ?? 0) },
      });
    },
  });
  const output = await mkdtemp(join(tmpdir(), 'astral-release-test-'));
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '--no-env-file',
        resolve(import.meta.dir, '../publish-internal-install-page.ts'),
        '--profile',
        'preview',
        '--title',
        'Synthetic release',
        '--out-dir',
        output,
      ],
      {
        env: {
          PATH: '/nonexistent',
          S3_ENDPOINT: storage.url.origin,
          S3_BUCKET: 'fixture-bucket',
          S3_ACCESS_KEY_ID: 'fixture-access',
          S3_SECRET_ACCESS_KEY: 'fixture-secret',
          S3_PUBLIC_BASE_URL: 'https://app.example/api/v1',
          RELEASE_LINK_SECRET: 'link-key',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(code, stderr).toBe(0);
    const metadata = JSON.parse(
      await readFile(join(output, 'publish-page.json'), 'utf8')
    );
    expect(metadata).toMatchObject({
      ios: false,
      android: true,
      pageUrl: `https://app.example/api/v1/releases/preview.html?token=${releaseAccessToken('link-key', 'releases/preview.html')}`,
    });
    expect(stdout).not.toContain('fixture-secret');
    expect(stdout + stderr).not.toContain(metadata.pageUrl);
    expect(stdout + stderr).not.toContain('?token=');
    const html = new TextDecoder().decode(objects.get('/releases/preview.html')!.body);
    expect(html).toContain('Download for Android');
    expect(html).toContain(releaseAccessToken('link-key', 'releases/preview.apk'));
    const png = objects.get('/releases/preview-qr.png')!;
    expect(png.type).toBe('image/png');
    expect([...png.body.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const header = new DataView(
      png.body.buffer,
      png.body.byteOffset,
      png.body.byteLength
    );
    expect(header.getUint32(16)).toBe(512);
    expect(header.getUint32(20)).toBe(512);
    expect(png.body).toEqual(
      new Uint8Array(await readFile(join(output, 'preview-qr.png')))
    );
  } finally {
    storage.stop(true);
    await rm(output, { recursive: true, force: true });
  }
});
