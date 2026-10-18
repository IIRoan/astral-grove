import { expect } from 'bun:test';

export type TimedResult<T> = {
  ms: number;
  status: number;
  data: T;
};

export async function timedJson<T>(
  label: string,
  fetcher: () => Promise<Response>
): Promise<TimedResult<T>> {
  const start = performance.now();
  const res = await fetcher();
  const body = await res.text();
  const ms = performance.now() - start;

  if (!res.ok) {
    throw new Error(`${label} → ${String(res.status)} in ${ms.toFixed(1)}ms: ${body}`);
  }

  return {
    ms,
    status: res.status,
    data: (body ? JSON.parse(body) : undefined) as T,
  };
}

export function assertMaxMs(label: string, ms: number, budgetMs: number): void {
  expect(ms).toBeLessThanOrEqual(budgetMs);
}

export function readBudget(name: string, fallback: number): number {
  const key = `E2E_BUDGET_${name.toUpperCase()}_MS`;
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
