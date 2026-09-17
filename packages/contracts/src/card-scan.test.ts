import { describe, expect, test } from 'bun:test';
import { ART_BIT_COUNT } from './card-art.js';
import {
  ART_HAMMING_CEILING,
  ART_SCORE_FLOOR,
  ART_SCORE_MARGIN,
  buildScanCatalog,
  decideArtScan,
  type ArtMatch,
  type ScanCard,
} from './card-scan.js';

const CDN = 'https://cdn.piltoverarchive.com';

function card(variantNumber: string, name: string, image: string | null): ScanCard {
  return { variantNumber, name, imageUrl: image ? `${CDN}/cards/${image}` : null };
}

/** One picture, one printing. */
const lux = card('OGN-179', 'Lux', 'lux.png');
/** Two pictures of the same card: the alt art is a different picture entirely. */
const luxAlt = card('OGN-179b', 'Lux', 'lux-alt.png');
/** One picture printed across two sets — art alone can never separate these. */
const furyOgn = card('OGN-021', 'Fury Rune', 'fury.png');
const furyVen = card('VEN-014', 'Fury Rune', 'fury.png');

const catalog = buildScanCatalog([lux, luxAlt, furyOgn, furyVen]);

function match(image: string, score: number, hamming = 4): ArtMatch {
  return { key: `cards/${image}`, score, hamming };
}

describe('buildScanCatalog', () => {
  test('groups printings that share a picture', () => {
    expect(catalog.byImageKey.get('cards/fury.png')).toEqual([furyOgn, furyVen]);
  });

  test('keeps different pictures of one card apart', () => {
    expect(catalog.byImageKey.get('cards/lux.png')).toEqual([lux]);
    expect(catalog.byImageKey.get('cards/lux-alt.png')).toEqual([luxAlt]);
  });

  test('indexes every form of an image url under one key', () => {
    const built = buildScanCatalog([
      card('A-1', 'One', 'shared.png'),
      {
        variantNumber: 'A-2',
        name: 'Two',
        imageUrl: '/api/v1/images/cards/shared.png',
      },
    ]);
    expect(built.byImageKey.size).toBe(1);
    expect(built.byImageKey.get('cards/shared.png')).toHaveLength(2);
  });

  test('skips printings with no usable image', () => {
    expect(buildScanCatalog([card('A-1', 'One', null)]).byImageKey.size).toBe(0);
  });
});

describe('decideArtScan', () => {
  test('takes a clear winner', () => {
    const decision = decideArtScan(catalog, [
      match('lux.png', 0.94),
      match('lux-alt.png', 0.71),
    ]);
    expect(decision).toEqual({ kind: 'card', card: lux });
  });

  test('asks which printing when one picture has several', () => {
    const decision = decideArtScan(catalog, [
      match('fury.png', 0.95),
      match('lux.png', 0.6),
    ]);
    expect(decision).toEqual({
      kind: 'hold',
      key: 'cards/fury.png',
      name: 'Fury Rune',
      options: [furyOgn, furyVen],
    });
  });

  test('abstains with nothing in frame', () => {
    expect(decideArtScan(catalog, [])).toBeNull();
  });

  test('abstains below the score floor', () => {
    const decision = decideArtScan(catalog, [
      match('lux.png', ART_SCORE_FLOOR - 0.01),
      match('fury.png', 0.2),
    ]);
    expect(decision).toBeNull();
  });

  test('takes a match sitting exactly on the floor', () => {
    const decision = decideArtScan(catalog, [
      match('lux.png', ART_SCORE_FLOOR),
      match('fury.png', 0.2),
    ]);
    expect(decision).toEqual({ kind: 'card', card: lux });
  });

  test('abstains when two different pictures are too close to call', () => {
    const decision = decideArtScan(catalog, [
      match('lux.png', 0.93),
      match('lux-alt.png', 0.93 - ART_SCORE_MARGIN / 2),
    ]);
    expect(decision).toBeNull();
  });

  test('takes a winner that clears the margin exactly', () => {
    const decision = decideArtScan(catalog, [
      match('lux.png', 0.93),
      match('lux-alt.png', 0.93 - ART_SCORE_MARGIN),
    ]);
    expect(decision).toEqual({ kind: 'card', card: lux });
  });

  test('ignores the margin against a repeat of the winning picture', () => {
    const decision = decideArtScan(catalog, [
      match('fury.png', 0.95),
      match('fury.png', 0.95),
      match('lux.png', 0.3),
    ]);
    expect(decision?.kind).toBe('hold');
  });

  test('abstains when the gradients disagree despite a high score', () => {
    const decision = decideArtScan(catalog, [
      { key: 'cards/lux.png', score: 0.97, hamming: ART_HAMMING_CEILING + 1 },
    ]);
    expect(decision).toBeNull();
  });

  test('accepts gradients sitting exactly on the ceiling', () => {
    const decision = decideArtScan(catalog, [
      { key: 'cards/lux.png', score: 0.97, hamming: ART_HAMMING_CEILING },
    ]);
    expect(decision).toEqual({ kind: 'card', card: lux });
  });

  test('abstains when the winning image is not in this catalog', () => {
    const decision = decideArtScan(catalog, [match('unknown.png', 0.99)]);
    expect(decision).toBeNull();
  });

  test('abstains against an empty catalog', () => {
    expect(decideArtScan(buildScanCatalog([]), [match('lux.png', 0.99)])).toBeNull();
  });

  test('keeps the ceiling inside the bit width it measures', () => {
    expect(ART_HAMMING_CEILING).toBeLessThan(ART_BIT_COUNT);
  });
});
