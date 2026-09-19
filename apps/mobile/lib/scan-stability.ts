import type { ScanCard, ScanDecision } from '@/lib/card-scan';

const MAX_GAP_MS = 1500;
const WINDOW_MS = 5000;

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

      // A name alone is not an identity: the available printings must agree too.
      const nextKey = JSON.stringify(
        decision.kind === 'card'
          ? ['card', decision.card.variantNumber]
          : ['hold', ...decision.options.map((card) => card.variantNumber).sort()]
      );
      if (nextKey !== key) reset();
      key = nextKey;
      misses = 0;
      readings = readings.filter((time) => now - time <= WINDOW_MS);
      readings.push(now);

      const required =
        decision.kind === 'card'
          ? decision.sure
            ? 1
            : 2
          : decision.options.length === 1
            ? 3
            : 6;
      if (readings.length < required) return null;
      reset();
      return decision;
    },
  };
}
