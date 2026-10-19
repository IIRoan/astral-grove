import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

export type Sample = { ms: number; status: number; bytes: number };
export function percentiles(values: number[]) {
  if (!values.length) throw new Error('Performance samples must not be empty');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1]!;
  return { p50: rank(0.5), p95: rank(0.95), p99: rank(0.99), max: sorted.at(-1)! };
}

export async function measure(
  name: string,
  operation: (index: number) => Promise<Sample>,
  options: { count: number; concurrency: number; warmup: number; budgetMs: number }
) {
  if (options.count < 1 || options.concurrency < 1 || options.warmup < 0)
    throw new Error('Invalid performance workload');
  let firstRequestMs: number | null = null;
  for (let index = 0; index < options.warmup; index++) {
    const sample = await operation(index);
    if (index === 0) firstRequestMs = sample.ms;
  }
  const samples: Sample[] = [];
  const failures: string[] = [];
  let next = 0;
  const start = performance.now();
  await Promise.all(
    Array.from({ length: Math.min(options.count, options.concurrency) }, async () => {
      while (next < options.count) {
        const index = next++;
        const started = performance.now();
        try {
          samples.push(await operation(index));
        } catch (error) {
          samples.push({ ms: performance.now() - started, status: 0, bytes: 0 });
          failures.push(error instanceof Error ? error.name : 'UnknownError');
        }
      }
    })
  );
  const elapsedMs = performance.now() - start;
  const statusCounts: Record<string, number> = {};
  for (const sample of samples)
    statusCounts[sample.status] = (statusCounts[sample.status] ?? 0) + 1;
  return {
    name,
    requests: options.count,
    concurrency: options.concurrency,
    warmupRequests: options.warmup,
    firstRequestMs,
    latencyMs: percentiles(samples.map((sample) => sample.ms)),
    samplesMs: samples.map((sample) => sample.ms),
    elapsedMs,
    requestsPerSecond: (options.count * 1000) / elapsedMs,
    responseBytes: samples.reduce((sum, sample) => sum + sample.bytes, 0),
    errors: failures.length,
    errorRate: failures.length / options.count,
    failureCategories: failures,
    statusCounts,
    budgetMs: options.budgetMs,
    passed:
      failures.length === 0 &&
      percentiles(samples.map((sample) => sample.ms)).p95 <= options.budgetMs,
  };
}

export async function waitUntil(
  check: () => boolean | Promise<boolean>,
  timeoutMs = 5000
) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(20);
  }
  throw new Error('Performance fixture did not reach its expected state');
}

export function barrier() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export class Resources {
  private peakRssBytes = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly ticks =
    process.platform === 'linux'
      ? Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim())
      : 0;
  constructor(private readonly pid: number) {}
  async snapshot() {
    if (process.platform !== 'linux') return null;
    const [status, stat, rollup] = await Promise.all([
      readFile(`/proc/${this.pid}/status`, 'utf8'),
      readFile(`/proc/${this.pid}/stat`, 'utf8'),
      readFile(`/proc/${this.pid}/smaps_rollup`, 'utf8'),
    ]);
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const rssBytes = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
    this.peakRssBytes = Math.max(
      this.peakRssBytes,
      rssBytes,
      Number(status.match(/^VmHWM:\s+(\d+)/m)?.[1] ?? 0) * 1024
    );
    return {
      rssBytes,
      pssBytes: Number(rollup.match(/^Pss:\s+(\d+)/m)?.[1] ?? 0) * 1024,
      cpuMs: ((Number(fields[11]) + Number(fields[12])) * 1000) / this.ticks,
      peakRssBytes: this.peakRssBytes,
    };
  }
  start() {
    if (process.platform !== 'linux') return;
    this.timer = setInterval(() => {
      void readFile(`/proc/${this.pid}/status`, 'utf8')
        .then((status) => {
          this.peakRssBytes = Math.max(
            this.peakRssBytes,
            Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024
          );
        })
        .catch(() => {});
    }, 100);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
