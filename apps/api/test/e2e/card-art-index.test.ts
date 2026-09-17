import { describe, expect, test } from 'bun:test';
import {
  ART_BIT_BYTES,
  ART_DESCRIPTOR_VERSION,
  ART_INDEX_HEADER_BYTES,
  ART_VECTOR_DIMENSION,
  FiltersResponse,
  artIndexKey,
  describeCardPixels,
  parseArtIndex,
} from '@riftbound/contracts';
import { cardArtFingerprints, variants } from '../../src/db/schema.js';
import { renderCanonicalFace } from '../../src/services/card-art-index.js';
import { syntheticCardImage } from '../fixtures/card-art.js';
import { apiFetch, apiJson, getContext } from './support.js';

async function readIndex() {
  const response = await apiFetch('/api/v1/cards/art-index');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { response, bytes, index: parseArtIndex(bytes) };
}

describe('card art index', () => {
  test('GET /api/v1/cards/art-index serves a well-formed packed index', async () => {
    const { response, bytes, index } = await readIndex();

    expect(bytes.length).toBeGreaterThanOrEqual(ART_INDEX_HEADER_BYTES);
    expect(index.version).toBe(ART_DESCRIPTOR_VERSION);
    expect(index.dimension).toBe(ART_VECTOR_DIMENSION);
    expect(index.bitBytes).toBe(ART_BIT_BYTES);
    expect(response.headers.get('x-art-index-count')).toBe(
      String(index.records.length)
    );
    expect(response.headers.get('etag')).toMatch(/^"[^"]+"$/);
  });

  test('a client holding the current index gets 304 rather than the bytes again', async () => {
    const { response } = await readIndex();
    const etag = response.headers.get('etag');
    expect(etag).toBeTruthy();

    const revalidated = await apiFetch('/api/v1/cards/art-index', {
      headers: { 'if-none-match': etag ?? '' },
    });

    expect(revalidated.status).toBe(304);
    expect((await revalidated.arrayBuffer()).byteLength).toBe(0);
  });

  test('filters meta advertises the hash a client checks staleness against', async () => {
    const { response } = await readIndex();
    const meta = FiltersResponse.parse(await apiJson<unknown>('/api/v1/filters')).meta;

    expect(meta.artDescriptorVersion).toBe(ART_DESCRIPTOR_VERSION);
    expect(`"${meta.artIndexHash}"`).toBe(response.headers.get('etag'));
  });

  test('a stored fingerprint is served under its catalog image key', async () => {
    const ctx = getContext();
    const rows = await ctx.db
      .select({ imageUrl: variants.imageUrl })
      .from(variants)
      .limit(200);
    // Some upstream variants still point at `/temporary/` uploads, which our image
    // cache does not serve either, so they have no index key by design.
    const key = rows.map((row) => artIndexKey(row.imageUrl)).find((it) => it !== '');
    expect(key).toBeTruthy();
    if (!key) return;

    const image = await syntheticCardImage(11);
    const { vector, bits } = describeCardPixels(
      await renderCanonicalFace(
        image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
      )
    );
    const encode = (bytes: Int8Array | Uint8Array) =>
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');

    await ctx.db
      .insert(cardArtFingerprints)
      .values({
        imageKey: key,
        descriptorVersion: ART_DESCRIPTOR_VERSION,
        vector: encode(vector),
        bits: encode(bits),
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cardArtFingerprints.imageKey,
        set: {
          descriptorVersion: ART_DESCRIPTOR_VERSION,
          vector: encode(vector),
          bits: encode(bits),
          computedAt: new Date(),
        },
      });
    ctx.cardArtIndex.invalidate();

    const { index } = await readIndex();
    const served = index.records.find((record) => record.key === key);

    expect(served).toBeDefined();
    expect(served?.vector).toEqual(vector);
    expect(served?.bits).toEqual(bits);
  });
});
