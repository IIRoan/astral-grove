export const DEFAULT_PRICE_HISTORY_RETAIN_DAYS = 90;
export const DEFAULT_PRICE_HISTORY_RETAIN_SNAPSHOTS = 30;

export type PriceHistoryRetention = {
  retainDays: number;
  retainSnapshotsPerSlot: number;
};

export function resolvePriceHistoryRetention(input?: {
  retainDays?: number;
  retainSnapshotsPerSlot?: number;
}): PriceHistoryRetention {
  return {
    retainDays: input?.retainDays ?? DEFAULT_PRICE_HISTORY_RETAIN_DAYS,
    retainSnapshotsPerSlot:
      input?.retainSnapshotsPerSlot ?? DEFAULT_PRICE_HISTORY_RETAIN_SNAPSHOTS,
  };
}

export function shouldPrunePriceHistoryRow(
  row: { capturedAt: Date; rankNewestFirst: number },
  retention: PriceHistoryRetention,
  now: Date
): boolean {
  const cutoffMs = now.getTime() - retention.retainDays * 24 * 60 * 60 * 1000;
  return (
    row.capturedAt.getTime() < cutoffMs ||
    row.rankNewestFirst > retention.retainSnapshotsPerSlot
  );
}
