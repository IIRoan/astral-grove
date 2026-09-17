import { describe, expect, test } from 'bun:test';
import {
  ART_BIT_BYTES,
  ART_BIT_COUNT,
  ART_DESCRIPTOR_VERSION,
  ART_IMAGE_HEIGHT,
  ART_IMAGE_WIDTH,
  ART_INDEX_HEADER_BYTES,
  ART_VECTOR_DIMENSION,
  artCosine,
  artHamming,
  artIndexKey,
  describeCardPixels,
  packArtIndex,
  parseArtIndex,
  type ArtIndexRecord,
} from './card-art.js';

const PIXELS = ART_IMAGE_WIDTH * ART_IMAGE_HEIGHT;

type Paint = (x: number, y: number) => [number, number, number];

function render(paint: Paint): Uint8Array {
  const rgb = new Uint8Array(PIXELS * 3);
  for (let y = 0; y < ART_IMAGE_HEIGHT; y += 1) {
    for (let x = 0; x < ART_IMAGE_WIDTH; x += 1) {
      const [red, green, blue] = paint(x, y);
      const at = (y * ART_IMAGE_WIDTH + x) * 3;
      rgb[at] = red;
      rgb[at + 1] = green;
      rgb[at + 2] = blue;
    }
  }
  return rgb;
}

/** A deterministic stand-in for card art: smooth colour fields plus local structure. */
function artwork(seed: number): Paint {
  return (x, y) => {
    const u = x / ART_IMAGE_WIDTH;
    const v = y / ART_IMAGE_HEIGHT;
    const red = 128 + 110 * Math.sin(seed + 6 * u + 2 * v);
    const green = 128 + 110 * Math.sin(seed * 1.7 + 3 * v - 4 * u);
    const blue = 128 + 110 * Math.sin(seed * 2.3 + 5 * u * v);
    return [clamp(red), clamp(green), clamp(blue)];
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Exposure: one gain and one offset across every channel. */
function adjust(paint: Paint, gain: number, offset: number): Paint {
  return (x, y) => {
    const [red, green, blue] = paint(x, y);
    return [
      clamp(red * gain + offset),
      clamp(green * gain + offset),
      clamp(blue * gain + offset),
    ];
  };
}

/** Illuminant: a separate gain per channel, which is what a warm room really does. */
function relight(paint: Paint, gains: [number, number, number]): Paint {
  return (x, y) => {
    const [red, green, blue] = paint(x, y);
    return [clamp(red * gains[0]), clamp(green * gains[1]), clamp(blue * gains[2])];
  };
}

/** Box blur, standing in for a camera that has not quite finished focusing. */
function blur(paint: Paint, radius: number): Paint {
  return (x, y) => {
    let red = 0;
    let green = 0;
    let blue = 0;
    let taken = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const sx = Math.max(0, Math.min(ART_IMAGE_WIDTH - 1, x + dx));
        const sy = Math.max(0, Math.min(ART_IMAGE_HEIGHT - 1, y + dy));
        const [r, g, b] = paint(sx, sy);
        red += r;
        green += g;
        blue += b;
        taken += 1;
      }
    }
    return [clamp(red / taken), clamp(green / taken), clamp(blue / taken)];
  };
}

describe('describeCardPixels', () => {
  test('produces a fixed-size descriptor', () => {
    const { vector, bits } = describeCardPixels(render(artwork(1)));
    expect(vector.length).toBe(ART_VECTOR_DIMENSION);
    expect(bits.length).toBe(ART_BIT_BYTES);
  });

  test('rejects pixel buffers that are not the canonical size', () => {
    expect(() => describeCardPixels(new Uint8Array(12), 2, 2)).toThrow();
    expect(() => describeCardPixels(new Uint8Array(12))).toThrow();
  });

  test('is deterministic', () => {
    const rgb = render(artwork(3));
    expect(describeCardPixels(rgb).vector).toEqual(describeCardPixels(rgb).vector);
  });

  test('pins the largest component to the int8 ceiling', () => {
    const { vector } = describeCardPixels(render(artwork(4)));
    let largest = 0;
    for (const value of vector) largest = Math.max(largest, Math.abs(value));
    expect(largest).toBe(127);
  });

  test('survives exposure drift', () => {
    const paint = artwork(5);
    const reference = describeCardPixels(render(paint));

    for (const [gain, offset] of [
      [0.85, 0],
      [1.15, 0],
      [1, 20],
      [1, -20],
      [0.9, 15],
    ] as const) {
      const shifted = describeCardPixels(render(adjust(paint, gain, offset)));
      expect(artCosine(reference.vector, shifted.vector)).toBeGreaterThan(0.97);
      expect(artHamming(reference.bits, shifted.bits)).toBeLessThan(16);
    }
  });

  test('survives a coloured illuminant', () => {
    const paint = artwork(5);
    const reference = describeCardPixels(render(paint));

    for (const gains of [
      [1.15, 1, 0.85],
      [0.85, 1, 1.15],
      [1, 1.1, 0.95],
    ] as const) {
      const relit = describeCardPixels(render(relight(paint, [...gains])));
      expect(artCosine(reference.vector, relit.vector)).toBeGreaterThan(0.95);
      expect(artHamming(reference.bits, relit.bits)).toBeLessThan(20);
    }
  });

  test('survives mild defocus', () => {
    const paint = artwork(6);
    const reference = describeCardPixels(render(paint));
    const soft = describeCardPixels(render(blur(paint, 3)));
    expect(artCosine(reference.vector, soft.vector)).toBeGreaterThan(0.95);
  });

  test('separates different artwork', () => {
    const first = describeCardPixels(render(artwork(7)));
    const second = describeCardPixels(render(artwork(29)));
    expect(artCosine(first.vector, second.vector)).toBeLessThan(0.7);
    expect(artHamming(first.bits, second.bits)).toBeGreaterThan(40);
  });

  test('normalizes a flat image to nothing rather than dividing by zero', () => {
    const { vector, bits } = describeCardPixels(render(() => [40, 40, 40]));
    expect([...vector].every((value) => value === 0)).toBe(true);
    expect([...bits].every((value) => value === 0)).toBe(true);
  });
});

describe('artCosine and artHamming', () => {
  test('score identical descriptors perfectly', () => {
    const { vector, bits } = describeCardPixels(render(artwork(8)));
    expect(artCosine(vector, vector)).toBeCloseTo(1, 10);
    expect(artHamming(bits, bits)).toBe(0);
  });

  test('treat mismatched lengths as no evidence', () => {
    expect(artCosine(new Int8Array(4), new Int8Array(8))).toBe(0);
    expect(artHamming(new Uint8Array(4), new Uint8Array(8))).toBe(ART_BIT_COUNT);
  });

  test('score an inverted bit string as maximally distant', () => {
    const bits = new Uint8Array(ART_BIT_BYTES).fill(0b10110010);
    const flipped = bits.map((byte) => ~byte & 0xff);
    expect(artHamming(bits, flipped)).toBe(ART_BIT_COUNT);
  });
});

describe('artIndexKey', () => {
  test.each([
    ['https://cdn.piltoverarchive.com/cards/ogn-179.png', 'cards/ogn-179.png'],
    ['https://api.example.com/api/v1/images/cards/ogn-179.png', 'cards/ogn-179.png'],
    ['/api/v1/images/cards/ogn-179.png', 'cards/ogn-179.png'],
    ['cards/ogn-179.png', 'cards/ogn-179.png'],
    [
      'https://api.example.com/api/v1/images/cards/ogn-179.png?w=320',
      'cards/ogn-179.png',
    ],
  ])('reduces %s to its object key', (url, expected) => {
    expect(artIndexKey(url)).toBe(expected);
  });

  test.each([
    [null],
    [undefined],
    [''],
    ['https://example.com/colors/fury.png'],
    ['/api/v1/images/thumbs/w96/cards/ogn-179.png'],
    ['cards/../secret.png'],
    ['not a url at all'],
  ])('refuses %s', (url) => {
    expect(artIndexKey(url)).toBe('');
  });

  test('agrees across every form of the same image', () => {
    const forms = [
      'https://cdn.piltoverarchive.com/cards/ven-150.png',
      'https://api.example.com/api/v1/images/cards/ven-150.png',
      '/api/v1/images/cards/ven-150.png',
      'cards/ven-150.png',
    ];
    expect(new Set(forms.map(artIndexKey)).size).toBe(1);
  });
});

describe('packArtIndex and parseArtIndex', () => {
  const records: ArtIndexRecord[] = [1, 2, 3].map((seed) => ({
    key: `cards/seed-${String(seed)}.png`,
    ...describeCardPixels(render(artwork(seed))),
  }));

  test('round-trips every record', () => {
    const parsed = parseArtIndex(packArtIndex(records));
    expect(parsed.version).toBe(ART_DESCRIPTOR_VERSION);
    expect(parsed.dimension).toBe(ART_VECTOR_DIMENSION);
    expect(parsed.bitBytes).toBe(ART_BIT_BYTES);
    expect(parsed.records).toEqual(records);
  });

  test('packs an empty index to a bare header', () => {
    const packed = packArtIndex([]);
    expect(packed.length).toBe(ART_INDEX_HEADER_BYTES);
    expect(parseArtIndex(packed).records).toEqual([]);
  });

  test('stays under the budget that makes this a one-second download', () => {
    const perRecord = packArtIndex(records).length / records.length;
    expect(perRecord).toBeLessThan(512);
  });

  test('rejects a record whose descriptor is the wrong shape', () => {
    const [first] = records;
    expect(() => packArtIndex([{ ...first!, vector: new Int8Array(8) }])).toThrow(
      /vector length/
    );
    expect(() => packArtIndex([{ ...first!, bits: new Uint8Array(8) }])).toThrow(
      /bit length/
    );
  });

  test('rejects an unusable key', () => {
    const [first] = records;
    expect(() => packArtIndex([{ ...first!, key: '' }])).toThrow(/1-255/);
    expect(() => packArtIndex([{ ...first!, key: 'c'.repeat(256) }])).toThrow(/1-255/);
  });

  test('refuses a buffer that is not an index', () => {
    expect(() => parseArtIndex(new Uint8Array(4))).toThrow(/header/);
    expect(() => parseArtIndex(new Uint8Array(ART_INDEX_HEADER_BYTES))).toThrow(
      /magic/
    );
  });

  test('refuses a truncated index rather than returning half of it', () => {
    const packed = packArtIndex(records);
    expect(() => parseArtIndex(packed.slice(0, packed.length - 10))).toThrow(
      /mid-record/
    );
  });

  test('parses a view into a larger buffer', () => {
    const packed = packArtIndex(records);
    const padded = new Uint8Array(packed.length + 8);
    padded.set(packed, 8);
    expect(parseArtIndex(padded.subarray(8)).records).toEqual(records);
  });
});
