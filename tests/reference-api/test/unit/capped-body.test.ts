import { describe, expect, test } from 'bun:test';
import { readCappedResponseBody } from '../../src/lib/capped-body.js';

describe('readCappedResponseBody', () => {
  test('returns the body when it is within the cap', async () => {
    const res = new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/webp' },
    });
    const body = await readCappedResponseBody(res, 16);
    expect(body?.byteLength).toBe(3);
  });

  test('rejects when Content-Length exceeds the cap without buffering', async () => {
    const res = new Response('x'.repeat(32), {
      headers: { 'content-length': '32' },
    });
    expect(await readCappedResponseBody(res, 8)).toBeNull();
  });

  test('rejects a streamed body that grows past the cap', async () => {
    const res = new Response(new Uint8Array(20), {
      headers: { 'content-type': 'image/webp' },
    });
    expect(await readCappedResponseBody(res, 8)).toBeNull();
  });
});
