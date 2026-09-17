/**
 * Write the fixture the native descriptor parity test compares against.
 *
 * The card scanner only works if two independent implementations of the same
 * arithmetic agree: this one, in TypeScript over sharp, which describes the catalog,
 * and `CardDescriptor.swift`, in CoreImage, which describes what the camera sees. The
 * fixture is generated rather than checked in so the golden values can never drift
 * away from the code that actually builds the index.
 *
 *   bun scripts/write-art-parity-fixture.ts <outDir>
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ART_DESCRIPTOR_VERSION,
  ART_IMAGE_HEIGHT,
  ART_IMAGE_WIDTH,
  describeCardPixels,
  packArtIndex,
} from '@riftbound/contracts';
import { renderCanonicalFace } from '../src/services/card-art-index.js';
import { syntheticCardImage } from '../test/fixtures/card-art.js';

const REFERENCE_IMAGE_PATH = 'cards/parity-reference.png';
/** A second, unrelated card, so the test can also check that scores separate. */
const DECOY_IMAGE_PATH = 'cards/parity-decoy.png';

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: bun scripts/write-art-parity-fixture.ts <outDir>');
  process.exit(1);
}

async function describe(seed: number) {
  const image = await syntheticCardImage(seed);
  const face = await renderCanonicalFace(
    image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
  );
  return { image, ...describeCardPixels(face) };
}

await mkdir(outDir, { recursive: true });

const reference = await describe(1);
const decoy = await describe(2);

await writeFile(join(outDir, 'reference-card.png'), reference.image);
await writeFile(join(outDir, 'decoy-card.png'), decoy.image);
await writeFile(
  join(outDir, 'reference-descriptor.json'),
  `${JSON.stringify(
    {
      version: ART_DESCRIPTOR_VERSION,
      width: ART_IMAGE_WIDTH,
      height: ART_IMAGE_HEIGHT,
      referenceKey: REFERENCE_IMAGE_PATH,
      decoyKey: DECOY_IMAGE_PATH,
      vector: [...reference.vector],
      bits: [...reference.bits],
      decoyVector: [...decoy.vector],
      decoyBits: [...decoy.bits],
    },
    null,
    2
  )}\n`
);
await writeFile(
  join(outDir, 'reference-index.bin'),
  packArtIndex([
    { key: REFERENCE_IMAGE_PATH, vector: reference.vector, bits: reference.bits },
    { key: DECOY_IMAGE_PATH, vector: decoy.vector, bits: decoy.bits },
  ])
);

console.log(`Wrote art parity fixture to ${outDir}`);
