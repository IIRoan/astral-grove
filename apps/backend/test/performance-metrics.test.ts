import { expect, test } from 'bun:test';
import { measure, percentiles, Resources } from './performance/metrics';

test('performance percentiles retain tail latency without mutating samples', () => {
  const values = Array.from({ length: 100 }, (_, index) => 100 - index);
  expect(percentiles(values)).toEqual({ p50: 50, p95: 95, p99: 99, max: 100 });
  expect(values[0]).toBe(100);
  expect(() => percentiles([])).toThrow();
});
test('load measurements exclude warmups, bound concurrency and count failures', async () => {
  let running = 0,
    maximum = 0,
    calls = 0;
  const result = await measure(
    'fixture',
    async () => {
      const call = ++calls;
      maximum = Math.max(maximum, ++running);
      await Bun.sleep(1);
      running--;
      if (call === 5) throw new Error('synthetic failure');
      return { ms: call, status: 200, bytes: 10 };
    },
    { count: 8, concurrency: 2, warmup: 2, budgetMs: 100 }
  );
  expect(calls).toBe(10);
  expect(maximum).toBe(2);
  expect(result.errors).toBe(1);
  expect(result.errorRate).toBe(1 / 8);
  expect(result.statusCounts).toEqual({ 0: 1, 200: 7 });
  expect(result.responseBytes).toBe(70);
  expect(result.firstRequestMs).toBe(1);
  expect(result.passed).toBe(false);
});
test('latency budgets reject slow successful requests and accept expected backpressure', async () => {
  const slow = await measure('slow', async () => ({ ms: 101, status: 200, bytes: 0 }), {
    count: 20,
    concurrency: 1,
    warmup: 0,
    budgetMs: 100,
  });
  expect(slow.errors).toBe(0);
  expect(slow.passed).toBe(false);
  const rejected = await measure(
    'backpressure',
    async () => ({ ms: 1, status: 503, bytes: 0 }),
    { count: 20, concurrency: 4, warmup: 0, budgetMs: 100 }
  );
  expect(rejected.statusCounts).toEqual({ 503: 20 });
  expect(rejected.passed).toBe(true);
});
test('resource snapshots report the observed process and kernel memory high-water mark', async () => {
  const resources = new Resources(process.pid);
  const sample = await resources.snapshot();
  if (process.platform !== 'linux') {
    expect(sample).toBeNull();
    return;
  }
  expect(sample).not.toBeNull();
  if (!sample) throw new Error('Missing Linux resource snapshot');
  expect(sample.rssBytes).toBeGreaterThan(0);
  expect(sample.pssBytes).toBeGreaterThan(0);
  expect(sample.peakRssBytes).toBeGreaterThanOrEqual(sample.rssBytes);
  expect(Number.isFinite(sample.cpuMs)).toBe(true);
});
