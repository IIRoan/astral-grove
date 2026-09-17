import sharp from 'sharp';

/**
 * Card-shaped test images for the visual scanner.
 *
 * Generated rather than checked in so the descriptor parity fixture the Swift side
 * compares against is always derived from the current TypeScript implementation. The
 * layout imitates a real print — black border, smooth art in the upper half, a lighter
 * rules box with text bands, a dark footer strip — because the descriptor averages over
 * a block grid and a flat test pattern would not exercise that.
 */

export const CARD_FIXTURE_WIDTH = 660;
export const CARD_FIXTURE_HEIGHT = 924;

export async function syntheticCardImage(
  seed: number,
  borderFraction = 0.045
): Promise<Buffer> {
  const border = Math.round(CARD_FIXTURE_WIDTH * borderFraction);
  const inner = {
    width: CARD_FIXTURE_WIDTH - border * 2,
    height: CARD_FIXTURE_HEIGHT - border * 2,
  };
  const pixels = Buffer.alloc(CARD_FIXTURE_WIDTH * CARD_FIXTURE_HEIGHT * 3);

  for (let y = 0; y < CARD_FIXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < CARD_FIXTURE_WIDTH; x += 1) {
      const at = (y * CARD_FIXTURE_WIDTH + x) * 3;
      const outside =
        x < border ||
        y < border ||
        x >= CARD_FIXTURE_WIDTH - border ||
        y >= CARD_FIXTURE_HEIGHT - border;
      const [red, green, blue] = outside
        ? ([12, 12, 14] as const)
        : facePixel((x - border) / inner.width, (y - border) / inner.height, seed);
      pixels[at] = red;
      pixels[at + 1] = green;
      pixels[at + 2] = blue;
    }
  }

  return sharp(pixels, {
    raw: { width: CARD_FIXTURE_WIDTH, height: CARD_FIXTURE_HEIGHT, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function facePixel(u: number, v: number, seed: number): [number, number, number] {
  const phase = seed * 1.7;

  if (v < 0.58) {
    const across = Math.sin((1.5 + seed * 0.6) * u * Math.PI * 2 + phase);
    const down = Math.cos((2.2 + seed * 0.4) * v * Math.PI * 2 + phase * 0.5);
    const diagonal = Math.sin((u + v) * Math.PI * (2 + (seed % 3)));
    return [
      clamp(150 + 80 * across * down),
      clamp(140 + 75 * down + 25 * diagonal),
      clamp(130 + 70 * diagonal * across + 30 * down),
    ];
  }

  if (v > 0.94) return [clamp(40 + 8 * seed), 42, 46];

  const band = (v * CARD_FIXTURE_HEIGHT) % 44 < 18 ? -55 : 0;
  const grain = Math.sin(u * Math.PI * 12 + phase) * 5;
  return [
    clamp(214 + grain + band),
    clamp(208 + grain + band),
    clamp(192 + grain + band),
  ];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
