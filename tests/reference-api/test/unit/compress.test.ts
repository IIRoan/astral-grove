import { describe, expect, test } from 'bun:test';
import { compress } from '@elysia/compress';
import { Elysia } from 'elysia';

function createApp() {
  return new Elysia()
    .use(compress())
    .get('/large', () => ({ payload: 'x'.repeat(2048) }))
    .get('/small', () => ({ ok: true }))
    .get(
      '/image',
      () =>
        new Response(new Uint8Array(2048).fill(1), {
          headers: { 'content-type': 'image/webp' },
        })
    );
}

describe('compress plugin', () => {
  test('gzip-encodes JSON above the 1 KiB threshold', async () => {
    const res = await createApp().handle(
      new Request('http://localhost/large', {
        headers: { 'accept-encoding': 'gzip' },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('vary')?.toLowerCase()).toContain('accept-encoding');

    const json = JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(await res.arrayBuffer())))
    ) as { payload: string };
    expect(json.payload).toHaveLength(2048);
  });

  test('skips JSON below the 1 KiB threshold', async () => {
    const res = await createApp().handle(
      new Request('http://localhost/small', {
        headers: { 'accept-encoding': 'gzip' },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test('skips already-compressed image bodies', async () => {
    const res = await createApp().handle(
      new Request('http://localhost/image', {
        headers: { 'accept-encoding': 'gzip' },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.arrayBuffer()).toHaveLength(2048);
  });
});
