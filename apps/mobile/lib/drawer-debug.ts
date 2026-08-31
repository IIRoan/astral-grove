import type { CatalogDrawerPresentation } from '@/lib/bottom-sheet-lifecycle';
import {
  isCatalogDrawerBlockingTaps,
  isCatalogDrawerClosing,
} from '@/lib/bottom-sheet-lifecycle';
import { logInfo } from '@/lib/logger';
import {
  isSheetDismissSuppressed,
  sheetDismissSuppressRemainingMs,
} from '@/lib/sheet-dismiss-guard';

export type DrawerLogFields = Record<string, unknown>;

export const DRAWER_OPEN_WATCH_MS = [0, 50, 150, 300, 800, 1600] as const;

let seq = 0;

export function resetDrawerLogSeq(): void {
  seq = 0;
}

export function snapshotPresentation(
  presentation: CatalogDrawerPresentation | null | undefined
): {
  sessionId: number | null;
  variantNumber: string | null;
  open: boolean | null;
  blockingTaps: boolean;
  closing: boolean;
} {
  return {
    sessionId: presentation?.sessionId ?? null,
    variantNumber: presentation?.variantNumber ?? null,
    open: presentation?.open ?? null,
    blockingTaps: isCatalogDrawerBlockingTaps(presentation ?? null),
    closing: isCatalogDrawerClosing(presentation ?? null),
  };
}

export function logDrawer(event: string, fields?: DrawerLogFields): void {
  seq += 1;
  logInfo(`drawer.${event}`, {
    seq,
    suppressMs: sheetDismissSuppressRemainingMs(),
    suppressed: isSheetDismissSuppressed(),
    ...fields,
  });
}

export function watchDrawerOpen(
  fields: DrawerLogFields,
  getLive: () => DrawerLogFields,
  delays: readonly number[] = DRAWER_OPEN_WATCH_MS
): () => void {
  logDrawer('open.watch.start', { ...fields, ...getLive() });
  const timers = delays.map((ms) =>
    setTimeout(() => {
      logDrawer('open.watch', { ms, ...fields, ...getLive() });
    }, ms)
  );

  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    logDrawer('open.watch.stop', { ...fields, ...getLive() });
  };
}
