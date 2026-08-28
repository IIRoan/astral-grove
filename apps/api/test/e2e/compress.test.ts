import { describe, expect, test } from 'bun:test';
import { CatalogIndexResponse } from '@riftbound/contracts';
import { getContext } from './support.js';

describe('response compression', () => {
  test('gzip-encodes large catalog JSON', async () => {
    const res = await getContext().app.handle(
      new Request('http://localhost/api/v1/cards/index', {
        headers: { 'accept-encoding': 'gzip' },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('gzip');

    const json: unknown = JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(await res.arrayBuffer())))
    );
    const parsed = CatalogIndexResponse.parse(json);
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  test('leaves small JSON uncompressed', async () => {
    const res = await getContext().app.handle(
      new Request('http://localhost/', {
        headers: { 'accept-encoding': 'gzip' },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('astral-grove-api');
  });
});
