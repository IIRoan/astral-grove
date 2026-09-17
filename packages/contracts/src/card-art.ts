/**
 * The visual fingerprint the scanner identifies cards by, and the packed index it
 * searches.
 *
 * A card is recognized by what it looks like, not by the collector code printed on it.
 * The descriptor below is deliberately plain arithmetic rather than a learned
 * embedding, because it has to be computed in two places that must agree: on the API
 * with sharp, over the catalog images we already store, and on the device with
 * CoreImage, over the camera's rectified view of a physical card. Anything the two
 * runtimes could disagree about — colour management, gamma, rounding — is either
 * avoided or pinned down here.
 *
 * Bump `ART_DESCRIPTOR_VERSION` whenever any constant or step below changes. Vectors
 * from different versions are not comparable, so the version travels in the index
 * header and a mismatch makes both sides discard what they have.
 */

import { z } from 'zod';

export const ART_DESCRIPTOR_VERSION = 1;

/**
 * Fraction trimmed from each edge of the located card before it is described. Absorbs
 * the black border, which carries no information, and the few pixels of background that
 * survive an imperfect rectification.
 *
 * Applied by each pipeline to its own source image, before the resize below, so the
 * trim happens at full resolution. It is not part of `describeCardPixels`.
 */
export const ART_TRIM_INSET = 0.03;

/** Canonical card face. 5:7, and both dimensions divide evenly by the block grid. */
export const ART_IMAGE_WIDTH = 160;
export const ART_IMAGE_HEIGHT = 224;

export const ART_GRID_COLUMNS = 10;
export const ART_GRID_ROWS = 14;
export const ART_BLOCK_COUNT = ART_GRID_COLUMNS * ART_GRID_ROWS;

/** Luma and two opponent-colour channels. */
export const ART_CHANNELS = 3;
export const ART_VECTOR_DIMENSION = ART_BLOCK_COUNT * ART_CHANNELS;

/** One bit per adjacent block pair, across then down. */
export const ART_BIT_COUNT =
  (ART_GRID_COLUMNS - 1) * ART_GRID_ROWS + ART_GRID_COLUMNS * (ART_GRID_ROWS - 1);
export const ART_BIT_BYTES = ART_BIT_COUNT / 8;

/** A standard deviation below this means a flat channel, which normalizes to nothing. */
const FLAT_CHANNEL_EPSILON = 1e-6;

export type CardDescriptor = {
  /** `ART_VECTOR_DIMENSION` values, channel-major, direction-quantized to int8. */
  vector: Int8Array;
  /** `ART_BIT_BYTES` of gradient signs, most significant bit first. */
  bits: Uint8Array;
};

/**
 * Describe one canonical card face.
 *
 * `rgb` must be `ART_IMAGE_WIDTH` × `ART_IMAGE_HEIGHT` tightly packed 8-bit RGB, with
 * no alpha and no colour profile applied — raw sRGB bytes, exactly as they were stored.
 * Converting to a linear space first would be more principled and is precisely the kind
 * of step sharp and CoreImage implement differently, so it is skipped on purpose.
 */
export function describeCardPixels(
  rgb: Uint8Array,
  width: number = ART_IMAGE_WIDTH,
  height: number = ART_IMAGE_HEIGHT
): CardDescriptor {
  if (width !== ART_IMAGE_WIDTH || height !== ART_IMAGE_HEIGHT) {
    throw new Error(
      `Card descriptor needs ${String(ART_IMAGE_WIDTH)}x${String(ART_IMAGE_HEIGHT)} pixels, got ${String(width)}x${String(height)}`
    );
  }
  if (rgb.length !== width * height * 3) {
    throw new Error(
      `Card descriptor needs ${String(width * height * 3)} RGB bytes, got ${String(rgb.length)}`
    );
  }

  const blockWidth = width / ART_GRID_COLUMNS;
  const blockHeight = height / ART_GRID_ROWS;

  const sums = new Float64Array(ART_BLOCK_COUNT * 3);
  for (let y = 0; y < height; y += 1) {
    const blockRow = Math.floor(y / blockHeight);
    for (let x = 0; x < width; x += 1) {
      const block = (blockRow * ART_GRID_COLUMNS + Math.floor(x / blockWidth)) * 3;
      const pixel = (y * width + x) * 3;
      sums[block] = sums[block]! + rgb[pixel]!;
      sums[block + 1] = sums[block + 1]! + rgb[pixel + 1]!;
      sums[block + 2] = sums[block + 2]! + rgb[pixel + 2]!;
    }
  }

  // Grey-world balance, before anything mixes the channels together. A different
  // illuminant multiplies R, G and B by three different factors, and dividing each by
  // its own average over the card cancels exactly that. It has to happen here: the
  // opponent channels below are differences, and no later centring or scaling of a
  // difference can undo a change that scaled its two terms unequally.
  const perBlock = 1 / (blockWidth * blockHeight);
  const gain = [0, 1, 2].map((channel) => {
    let total = 0;
    for (let block = 0; block < ART_BLOCK_COUNT; block += 1) {
      total += sums[block * 3 + channel]!;
    }
    const mean = (total * perBlock) / ART_BLOCK_COUNT;
    return mean < FLAT_CHANNEL_EPSILON ? 0 : 1 / mean;
  });

  // Opponent channels are linear in R, G and B, so averaging the pixels first and
  // converting once per block gives the same numbers as converting every pixel.
  const values = new Float64Array(ART_VECTOR_DIMENSION);
  for (let block = 0; block < ART_BLOCK_COUNT; block += 1) {
    const red = sums[block * 3]! * perBlock * gain[0]!;
    const green = sums[block * 3 + 1]! * perBlock * gain[1]!;
    const blue = sums[block * 3 + 2]! * perBlock * gain[2]!;
    values[block] = 0.299 * red + 0.587 * green + 0.114 * blue;
    values[ART_BLOCK_COUNT + block] = red - green;
    values[ART_BLOCK_COUNT * 2 + block] = (red + green) / 2 - blue;
  }

  // Per channel, centre and scale. Together with the balance above this is what makes
  // exposure stop mattering, and it is the difference between matching a photo of a
  // card and matching a scan of one.
  for (let channel = 0; channel < ART_CHANNELS; channel += 1) {
    const offset = channel * ART_BLOCK_COUNT;
    let mean = 0;
    for (let i = 0; i < ART_BLOCK_COUNT; i += 1) mean += values[offset + i]!;
    mean /= ART_BLOCK_COUNT;

    let variance = 0;
    for (let i = 0; i < ART_BLOCK_COUNT; i += 1) {
      const centred = values[offset + i]! - mean;
      variance += centred * centred;
    }
    const deviation = Math.sqrt(variance / ART_BLOCK_COUNT);

    const scale = deviation < FLAT_CHANNEL_EPSILON ? 0 : 1 / deviation;
    for (let i = 0; i < ART_BLOCK_COUNT; i += 1) {
      values[offset + i] = (values[offset + i]! - mean) * scale;
    }
  }

  return { vector: quantize(values), bits: gradientBits(values) };
}

/**
 * Direction only: the magnitude is divided out, then the largest component is pinned to
 * 127. Cosine similarity is unchanged by both, so the stored scale factor would never
 * be read and is not kept.
 */
function quantize(values: Float64Array): Int8Array {
  let norm = 0;
  for (const value of values) norm += value * value;
  norm = Math.sqrt(norm);

  const quantized = new Int8Array(ART_VECTOR_DIMENSION);
  if (norm < FLAT_CHANNEL_EPSILON) return quantized;

  let largest = 0;
  for (const value of values) largest = Math.max(largest, Math.abs(value / norm));
  if (largest < FLAT_CHANNEL_EPSILON) return quantized;

  const scale = 127 / (largest * norm);
  for (let i = 0; i < ART_VECTOR_DIMENSION; i += 1) {
    // floor(v + 0.5) rather than a rounding function: Swift rounds halves away from
    // zero and JavaScript rounds them up, and the two must not disagree.
    const rounded = Math.floor(values[i]! * scale + 0.5);
    quantized[i] = Math.max(-127, Math.min(127, rounded));
  }
  return quantized;
}

/**
 * Sign of the luma difference between each pair of neighbouring blocks. Gradient
 * directions survive blur, glare and a dim room far better than the values themselves,
 * so these bits are what separates two cards whose colour layout is nearly the same.
 */
function gradientBits(values: Float64Array): Uint8Array {
  const bits = new Uint8Array(ART_BIT_BYTES);
  let index = 0;
  const write = (on: boolean) => {
    const at = index >> 3;
    if (on) bits[at] = bits[at]! | (1 << (7 - (index & 7)));
    index += 1;
  };

  for (let row = 0; row < ART_GRID_ROWS; row += 1) {
    for (let column = 0; column + 1 < ART_GRID_COLUMNS; column += 1) {
      const at = row * ART_GRID_COLUMNS + column;
      write(values[at]! < values[at + 1]!);
    }
  }
  for (let row = 0; row + 1 < ART_GRID_ROWS; row += 1) {
    for (let column = 0; column < ART_GRID_COLUMNS; column += 1) {
      const at = row * ART_GRID_COLUMNS + column;
      write(values[at]! < values[at + ART_GRID_COLUMNS]!);
    }
  }
  return bits;
}

/** Cosine similarity of two quantized descriptors: 1 is identical, 0 unrelated. */
export function artCosine(a: Int8Array, b: Int8Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    dot += left * right;
    leftNorm += left * left;
    rightNorm += right * right;
  }
  const norm = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return norm === 0 ? 0 : dot / norm;
}

const POPCOUNT = Uint8Array.from({ length: 256 }, (_, byte) => {
  let count = 0;
  for (let value = byte; value > 0; value >>= 1) count += value & 1;
  return count;
});

/** How many of the gradient bits disagree. 0 is identical, `ART_BIT_COUNT` opposite. */
export function artHamming(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return ART_BIT_COUNT;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) distance += POPCOUNT[(a[i]! ^ b[i]!) & 0xff]!;
  return distance;
}

/**
 * Catalog images are addressed by several URLs — the CDN, this API, a relative path —
 * and the index and the client have to agree on one. The stored object key is the only
 * form all of them share.
 */
export function artIndexKey(imageUrl: string | null | undefined): string {
  if (!imageUrl) return '';

  // Hand-rolled rather than `new URL`: this runs in the app, the API and the tests, and
  // a relative path has to come through it unchanged.
  const path = imageUrl.replace(/^https?:\/\/[^/]*/i, '');
  const withoutQuery = path.split('?')[0] ?? '';
  if (withoutQuery.includes('..') || withoutQuery.includes('/thumbs/')) return '';
  if (withoutQuery.startsWith('cards/')) return withoutQuery;

  const at = withoutQuery.indexOf('/cards/');
  return at < 0 ? '' : withoutQuery.slice(at + 1);
}

export const ART_INDEX_MAGIC = 'RBAI';
/** Magic, version, dimension, bit width, reserved, count. */
export const ART_INDEX_HEADER_BYTES = 16;
/** Keys are object paths, and the record header spends one byte on their length. */
const MAX_KEY_BYTES = 255;

export type ArtIndexRecord = {
  /** `artIndexKey` of the catalog image this describes. */
  key: string;
  vector: Int8Array;
  bits: Uint8Array;
};

export type ArtIndex = {
  version: number;
  dimension: number;
  bitBytes: number;
  records: ArtIndexRecord[];
};

function recordBytes(record: ArtIndexRecord): number {
  return 1 + record.key.length + record.vector.length + record.bits.length;
}

/**
 * Pack the reference descriptors into the single buffer the device installs.
 *
 * One flat blob rather than JSON: the client never looks inside it, it goes straight
 * from the response to the native matcher, and at a few hundred bytes per printing the
 * whole catalog is a one-second download instead of the megabytes of card art an
 * on-device index would have needed.
 */
export function packArtIndex(records: readonly ArtIndexRecord[]): Uint8Array {
  let size = ART_INDEX_HEADER_BYTES;
  for (const record of records) {
    if (record.vector.length !== ART_VECTOR_DIMENSION) {
      throw new Error(`Art index record ${record.key} has the wrong vector length`);
    }
    if (record.bits.length !== ART_BIT_BYTES) {
      throw new Error(`Art index record ${record.key} has the wrong bit length`);
    }
    if (record.key.length === 0 || record.key.length > MAX_KEY_BYTES) {
      throw new Error(`Art index record key must be 1-255 bytes: "${record.key}"`);
    }
    size += recordBytes(record);
  }

  const packed = new Uint8Array(size);
  const view = new DataView(packed.buffer);
  for (let i = 0; i < ART_INDEX_MAGIC.length; i += 1) {
    packed[i] = ART_INDEX_MAGIC.charCodeAt(i);
  }
  view.setUint16(4, ART_DESCRIPTOR_VERSION, true);
  view.setUint16(6, ART_VECTOR_DIMENSION, true);
  view.setUint16(8, ART_BIT_BYTES, true);
  view.setUint16(10, 0, true);
  view.setUint32(12, records.length, true);

  let at = ART_INDEX_HEADER_BYTES;
  for (const record of records) {
    packed[at] = record.key.length;
    at += 1;
    for (let i = 0; i < record.key.length; i += 1) {
      packed[at + i] = record.key.charCodeAt(i) & 0xff;
    }
    at += record.key.length;
    packed.set(
      new Uint8Array(
        record.vector.buffer,
        record.vector.byteOffset,
        record.vector.length
      ),
      at
    );
    at += record.vector.length;
    packed.set(record.bits, at);
    at += record.bits.length;
  }

  return packed;
}

/** Read a packed index back. Throws on anything malformed rather than guessing. */
export function parseArtIndex(buffer: Uint8Array): ArtIndex {
  if (buffer.length < ART_INDEX_HEADER_BYTES) {
    throw new Error('Art index is shorter than its header');
  }
  for (let i = 0; i < ART_INDEX_MAGIC.length; i += 1) {
    if (buffer[i] !== ART_INDEX_MAGIC.charCodeAt(i)) {
      throw new Error('Art index has the wrong magic bytes');
    }
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const version = view.getUint16(4, true);
  const dimension = view.getUint16(6, true);
  const bitBytes = view.getUint16(8, true);
  const count = view.getUint32(12, true);

  const records: ArtIndexRecord[] = [];
  let at = ART_INDEX_HEADER_BYTES;
  for (let i = 0; i < count; i += 1) {
    if (at >= buffer.length) throw new Error('Art index ended mid-record');
    const keyLength = buffer[at]!;
    at += 1;
    const end = at + keyLength + dimension + bitBytes;
    if (keyLength === 0 || end > buffer.length) {
      throw new Error('Art index ended mid-record');
    }

    let key = '';
    for (let c = 0; c < keyLength; c += 1) key += String.fromCharCode(buffer[at + c]!);
    at += keyLength;

    const vector = new Int8Array(dimension);
    vector.set(new Int8Array(buffer.buffer, buffer.byteOffset + at, dimension));
    at += dimension;

    const bits = buffer.slice(at, at + bitBytes);
    at += bitBytes;

    records.push({ key, vector, bits });
  }

  return { version, dimension, bitBytes, records };
}

/** Staleness check for the packed index, alongside the catalog and price hashes. */
export const ArtIndexMeta = z.object({
  descriptorVersion: z.number().int().nonnegative(),
  indexHash: z.string(),
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

export type ArtIndexMeta = z.infer<typeof ArtIndexMeta>;
