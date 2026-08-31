import { afterEach, describe, expect, test } from 'bun:test';
import {
  logDrawer,
  resetDrawerLogSeq,
  snapshotPresentation,
  watchDrawerOpen,
} from '@/lib/drawer-debug';
import { createCatalogDrawerPresentation } from '@/lib/bottom-sheet-lifecycle';

describe('drawer debug snapshots', () => {
  const originalLog = console.log;

  afterEach(() => {
    console.log = originalLog;
    resetDrawerLogSeq();
  });

  test('snapshotPresentation flags tap blocking vs closing', () => {
    expect(snapshotPresentation(null)).toEqual({
      sessionId: null,
      variantNumber: null,
      open: null,
      blockingTaps: false,
      closing: false,
    });

    const open = createCatalogDrawerPresentation(3, 'OGN-001');
    expect(snapshotPresentation(open).open).toBe(true);
    expect(snapshotPresentation(open).blockingTaps).toBe(true);
    expect(snapshotPresentation({ ...open, open: false }).closing).toBe(true);
  });

  test('logDrawer prefixes events and increments seq', () => {
    const lines: string[] = [];
    console.log = ((line: string) => {
      lines.push(line);
    }) as typeof console.log;

    logDrawer('tile.press', { variantNumber: 'OGN-001' });
    logDrawer('host.select', { variantNumber: 'OGN-001' });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"event":"drawer.tile.press"');
    expect(lines[0]).toContain('"seq":1');
    expect(lines[1]).toContain('"event":"drawer.host.select"');
    expect(lines[1]).toContain('"seq":2');
  });

  test('watchDrawerOpen logs start and stop when delays are empty', () => {
    const lines: string[] = [];
    console.log = ((line: string) => {
      lines.push(line);
    }) as typeof console.log;

    const stop = watchDrawerOpen({ portalId: 'x' }, () => ({ dismissing: false }), []);
    stop();

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"event":"drawer.open.watch.start"');
    expect(lines[1]).toContain('"event":"drawer.open.watch.stop"');
  });
});
