import { describe, expect, test } from 'bun:test';
import type { ScanDecision } from '@riftbound/contracts';
import { createScanStability } from './scan-stability';

const lux = {
  name: 'Lux, Crownguard',
  variantNumber: 'OGS-014',
  imageUrl: 'cards/lux.png',
};
const other = { ...lux, variantNumber: 'OGS-015' };
const card: ScanDecision<typeof lux> = { kind: 'card', card: lux };
const hold: ScanDecision<typeof lux> = {
  kind: 'hold',
  key: 'cards/lux.png',
  name: lux.name,
  options: [lux, other],
};

describe('scan stability', () => {
  test('a single frame cannot open confirmation', () => {
    const tracker = createScanStability<typeof lux>();
    expect(tracker.record(card, 0)).toBeNull();
    expect(tracker.record(card, 100)).toEqual(card);
  });

  test('a shared artwork needs more agreement than a single printing', () => {
    const tracker = createScanStability<typeof lux>();
    expect(tracker.record(hold, 0)).toBeNull();
    expect(tracker.record(hold, 100)).toBeNull();
    expect(tracker.record(hold, 200)).toEqual(hold);
  });

  test('recognition survives one unreadable frame in dim light', () => {
    const tracker = createScanStability<typeof lux>();
    expect(tracker.record(card, 0)).toBeNull();
    expect(tracker.record(null, 100)).toBeNull();
    expect(tracker.record(card, 200)).toEqual(card);
  });

  test('repeated blank frames reset earlier evidence', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(card, 0);
    tracker.record(null, 100);
    tracker.record(null, 200);
    expect(tracker.record(card, 300)).toBeNull();
  });

  test('a competing card resets earlier evidence', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(card, 0);
    expect(tracker.record({ kind: 'card', card: other }, 100)).toBeNull();
    expect(tracker.record(card, 200)).toBeNull();
    expect(tracker.record(card, 300)).toEqual(card);
  });

  test('evidence expires after a pause', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(card, 0);
    expect(tracker.record(card, 600)).toBeNull();
    expect(tracker.record(card, 700)).toEqual(card);
  });

  test('a match and the artwork it shares are different evidence', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(hold, 0);
    expect(tracker.record(card, 100)).toBeNull();
    expect(tracker.record(card, 200)).toEqual(card);
  });

  test('reset after answering a card prevents evidence carrying into the next scan', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(card, 0);
    tracker.reset();
    expect(tracker.record(card, 100)).toBeNull();
  });

  test('scattered matches cannot accumulate indefinitely', () => {
    const tracker = createScanStability<typeof lux>();
    for (let i = 0; i < 10; i++) {
      expect(tracker.record(hold, i * 500)).toBeNull();
    }
  });
});
