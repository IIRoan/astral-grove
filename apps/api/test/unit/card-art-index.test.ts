import { describe, expect, test } from 'bun:test';
import {
  ART_BIT_BYTES,
  ART_IMAGE_HEIGHT,
  ART_IMAGE_WIDTH,
  ART_VECTOR_DIMENSION,
  artCosine,
  artHamming,
  describeCardPixels,
  type CardDescriptor,
} from '@riftbound/contracts';
import sharp from 'sharp';
import { renderCanonicalFace } from '../../src/services/card-art-index.js';
import {
  CARD_FIXTURE_HEIGHT,
  CARD_FIXTURE_WIDTH,
  syntheticCardImage,
} from '../fixtures/card-art.js';

async function describeImage(image: Buffer): Promise<CardDescriptor> {
  const face = await renderCanonicalFace(
    image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
  );
  return describeCardPixels(face);
}

/** What the camera does to a card: different exposure, focus, scale and codec. */
const degradations: { name: string; apply: (image: sharp.Sharp) => sharp.Sharp }[] = [
  { name: 'brightened 15%', apply: (image) => image.modulate({ brightness: 1.15 }) },
  { name: 'darkened 20%', apply: (image) => image.modulate({ brightness: 0.8 }) },
  {
    // A per-channel gain is what a different illuminant actually does. `tint` would
    // collapse every pixel onto one hue, which is not white balance.
    name: 'warm illuminant',
    apply: (image) => image.linear([1.14, 1, 0.84], [0, 0, 0]),
  },
  {
    name: 'cool illuminant',
    apply: (image) => image.linear([0.88, 1, 1.12], [0, 0, 0]),
  },
  { name: 'soft focus', apply: (image) => image.blur(2.5) },
  { name: 'jpeg at quality 65', apply: (image) => image.jpeg({ quality: 65 }) },
  {
    name: 'downscaled to 320px',
    apply: (image) => image.resize({ width: 320 }),
  },
];

describe('renderCanonicalFace', () => {
  test('produces exactly one canonical card face of raw RGB', async () => {
    const face = await renderCanonicalFace(bufferSource(await syntheticCardImage(1)));

    expect(face.length).toBe(ART_IMAGE_WIDTH * ART_IMAGE_HEIGHT * 3);
  });

  test('tolerates the framing error a live rectification will have', async () => {
    const image = await syntheticCardImage(1);
    const reference = await describeImage(image);
    const inset = Math.round(CARD_FIXTURE_WIDTH * 0.015);
    const tighter = await describeImage(
      await sharp(image)
        .extract({
          left: inset,
          top: inset,
          width: CARD_FIXTURE_WIDTH - inset * 2,
          height: CARD_FIXTURE_HEIGHT - inset * 2,
        })
        .png()
        .toBuffer()
    );

    expect(artCosine(reference.vector, tighter.vector)).toBeGreaterThan(0.95);
  });

  test('rejects an image it cannot read dimensions for', async () => {
    await expect(renderCanonicalFace(new ArrayBuffer(8))).rejects.toThrow();
  });
});

describe('card art descriptor over encoded images', () => {
  test('is deterministic for the same bytes', async () => {
    const image = await syntheticCardImage(3);
    const [first, second] = await Promise.all([
      describeImage(image),
      describeImage(image),
    ]);

    expect(first.vector).toEqual(second.vector);
    expect(first.bits).toEqual(second.bits);
    expect(first.vector.length).toBe(ART_VECTOR_DIMENSION);
    expect(first.bits.length).toBe(ART_BIT_BYTES);
  });

  for (const { name, apply } of degradations) {
    test(`survives ${name}`, async () => {
      const image = await syntheticCardImage(3);
      const reference = await describeImage(image);
      const degraded = await describeImage(await apply(sharp(image)).png().toBuffer());

      expect(artCosine(reference.vector, degraded.vector)).toBeGreaterThan(0.95);
      expect(artHamming(reference.bits, degraded.bits)).toBeLessThan(24);
    });
  }

  test('separates different artwork by a wide margin', async () => {
    const descriptors = await Promise.all(
      [1, 2, 3, 4, 5].map(async (seed) => describeImage(await syntheticCardImage(seed)))
    );

    for (let left = 0; left < descriptors.length; left += 1) {
      for (let right = left + 1; right < descriptors.length; right += 1) {
        const similarity = artCosine(
          descriptors[left]!.vector,
          descriptors[right]!.vector
        );
        expect(similarity).toBeLessThan(0.8);
      }
    }
  });

  test('a degraded card still ranks above every other card', async () => {
    const target = 3;
    const reference = await Promise.all(
      [1, 2, 3, 4, 5].map(async (seed) => ({
        seed,
        descriptor: await describeImage(await syntheticCardImage(seed)),
      }))
    );
    const photo = await describeImage(
      await sharp(await syntheticCardImage(target))
        .modulate({ brightness: 1.2 })
        .blur(2)
        .jpeg({ quality: 70 })
        .toBuffer()
    );

    const ranked = reference
      .map((row) => ({
        seed: row.seed,
        score: artCosine(photo.vector, row.descriptor.vector),
      }))
      .sort((left, right) => right.score - left.score);

    expect(ranked[0]?.seed).toBe(target);
    expect((ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0)).toBeGreaterThan(0.1);
  });
});

function bufferSource(image: Buffer): ArrayBuffer {
  return image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength);
}
