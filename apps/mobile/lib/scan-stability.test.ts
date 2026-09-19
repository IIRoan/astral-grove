import { describe, expect, test } from 'bun:test';
import type { ScanDecision } from '@/lib/card-scan';
import { createScanStability } from './scan-stability';

const lux = { name: 'Lux, Crownguard', variantNumber: 'OGS-014', imageUrl: 'lux' };
const other = { ...lux, variantNumber: 'OGS-015' };
const code: ScanDecision<typeof lux> = {
  kind: 'card',
  card: lux,
  via: 'code',
  sure: false,
};
const art: ScanDecision<typeof lux> = {
  kind: 'hold',
  key: 'lux',
  name: lux.name,
  options: [lux],
};

describe('scan stability', () => {
  test('a single uncertain OCR reading cannot open confirmation', () => {
    const tracker = createScanStability<typeof lux>();
    expect(tracker.record(code, 0)).toBeNull();
    expect(tracker.record(code, 300)).toEqual(code);
  });

  test('agreement between collector code and artwork remains immediate', () => {
    const tracker = createScanStability<typeof lux>();
    const agreed = { ...code, sure: true };
    expect(tracker.record(agreed, 0)).toEqual(agreed);
  });

  test('art recognition survives one unreadable frame in dim light', () => {
    const tracker = createScanStability<typeof lux>();
    expect(tracker.record(art, 0)).toBeNull();
    expect(tracker.record(null, 300)).toBeNull();
    expect(tracker.record(art, 600)).toBeNull();
    expect(tracker.record(art, 900)).toEqual(art);
  });

  test('repeated blank frames reset earlier evidence', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(code, 0);
    tracker.record(null, 300);
    tracker.record(null, 600);
    expect(tracker.record(code, 900)).toBeNull();
  });

  test('a competing card resets earlier evidence', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(code, 0);
    expect(tracker.record({ ...code, card: other }, 300)).toBeNull();
    expect(tracker.record(code, 600)).toBeNull();
    expect(tracker.record(code, 900)).toEqual(code);
  });

  test('evidence expires after a pause', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(code, 0);
    expect(tracker.record(code, 2000)).toBeNull();
    expect(tracker.record(code, 2300)).toEqual(code);
  });

  test('reset after answering a card prevents evidence carrying into the next scan', () => {
    const tracker = createScanStability<typeof lux>();
    tracker.record(code, 0);
    tracker.reset();
    expect(tracker.record(code, 300)).toBeNull();
  });

  test('ambiguous printings need six consistent reads, independent of option order', () => {
    const tracker = createScanStability<typeof lux>();
    const ambiguous = { ...art, options: [lux, other] };
    for (let i = 0; i < 5; i++) {
      expect(tracker.record(ambiguous, i * 300)).toBeNull();
    }
    const reordered = { ...ambiguous, options: [other, lux] };
    expect(tracker.record(reordered, 1500)).toEqual(reordered);
  });

  test('different printing options with the same name do not share evidence', () => {
    const tracker = createScanStability<typeof lux>();
    const ambiguous = { ...art, options: [lux, other] };
    for (let i = 0; i < 5; i++) tracker.record(ambiguous, i * 300);
    expect(tracker.record({ ...ambiguous, options: [lux] }, 1500)).toBeNull();
  });

  test('scattered matches cannot accumulate indefinitely', () => {
    const tracker = createScanStability<typeof lux>();
    const ambiguous = { ...art, options: [lux, other] };
    for (let i = 0; i < 10; i++) {
      expect(tracker.record(ambiguous, i * 1400)).toBeNull();
    }
  });
});
