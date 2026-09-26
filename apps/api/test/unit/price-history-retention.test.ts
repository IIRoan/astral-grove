import { describe, expect, test } from 'bun:test';
import {
  resolvePriceHistoryRetention,
  shouldPrunePriceHistoryRow,
} from '../../src/lib/price-history-retention.js';

describe('price history retention', () => {
  test('defaults to 90 days and 30 snapshots per slot', () => {
    expect(resolvePriceHistoryRetention()).toEqual({
      retainDays: 90,
      retainSnapshotsPerSlot: 30,
    });
  });

  test('deletes rows older than the window even if they are recent ranks', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const retention = resolvePriceHistoryRetention({
      retainDays: 30,
      retainSnapshotsPerSlot: 50,
    });
    expect(
      shouldPrunePriceHistoryRow(
        { capturedAt: new Date('2026-07-01T00:00:00.000Z'), rankNewestFirst: 1 },
        retention,
        now
      )
    ).toBe(true);
  });

  test('deletes ranks beyond the per-slot cap even when still inside the window', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const retention = resolvePriceHistoryRetention({
      retainDays: 90,
      retainSnapshotsPerSlot: 2,
    });
    expect(
      shouldPrunePriceHistoryRow(
        { capturedAt: new Date('2026-09-10T00:00:00.000Z'), rankNewestFirst: 3 },
        retention,
        now
      )
    ).toBe(true);
  });

  test('keeps the newest snapshots inside the window', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const retention = resolvePriceHistoryRetention();
    expect(
      shouldPrunePriceHistoryRow(
        { capturedAt: new Date('2026-09-01T00:00:00.000Z'), rankNewestFirst: 1 },
        retention,
        now
      )
    ).toBe(false);
  });
});
