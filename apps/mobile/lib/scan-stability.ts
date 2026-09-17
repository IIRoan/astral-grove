import type { ScanCard, ScanDecision } from '@riftbound/contracts';

/** Longer than this between agreeing frames and the card was probably moved away. */
const MAX_GAP_MS = 400;
/** Evidence older than this is stale, whatever it said. */
const WINDOW_MS = 1500;
/** Frames that must agree before a match is offered. */
const REQUIRED_CARD = 2;
/** More for a shared artwork, because answering it costs the user a choice. */
const REQUIRED_HOLD = 3;

/** Require repeat evidence while allowing one missed read from blur or exposure changes. */
export function createScanStability<T extends ScanCard>() {
  let key: string | null = null;
  let readings: number[] = [];
  let misses = 0;

  const reset = () => {
    key = null;
    readings = [];
    misses = 0;
  };

  return {
    reset,
    record(decision: ScanDecision<T>, now: number): ScanDecision<T> {
      const last = readings.at(-1);
      if (last !== undefined && (now - last > MAX_GAP_MS || now < last)) reset();
      if (!decision) {
        if (++misses > 1) reset();
        return null;
      }

      const nextKey =
        decision.kind === 'card'
          ? `card:${decision.card.variantNumber}`
          : `hold:${decision.key}`;
      if (nextKey !== key) reset();
      key = nextKey;
      misses = 0;
      readings = readings.filter((time) => now - time <= WINDOW_MS);
      readings.push(now);

      const required = decision.kind === 'card' ? REQUIRED_CARD : REQUIRED_HOLD;
      if (readings.length < required) return null;
      reset();
      return decision;
    },
  };
}
