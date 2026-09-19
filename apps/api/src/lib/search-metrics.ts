import type { CardsListQuery, GlobalSearchQuery } from '@riftbound/contracts';

type LogLevel = 'info' | 'warn';

export type SearchMetricEvent =
  | 'search.cache'
  | 'search.postgres.query'
  | 'search.complete'
  | 'search.pipeline'
  | 'search.global'
  | 'search.reconcile';

export function isSearchMetricsEnabled(): boolean {
  if (process.env.SEARCH_METRICS_LOG === 'true') return true;
  if (process.env.SEARCH_METRICS_LOG === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function write(
  level: LogLevel,
  event: SearchMetricEvent,
  fields: Record<string, unknown>
): void {
  if (!isSearchMetricsEnabled()) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    subsystem: 'search',
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function summarizeCardsListQuery(
  query: CardsListQuery
): Record<string, unknown> {
  return {
    q: query.q?.trim() || null,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    dir: query.dir,
    sets: query.sets ?? null,
    types: query.types ?? null,
    colors: query.colors ?? null,
    colorMode: query.colorMode ?? 'all',
    super: query.super ?? null,
    variants: query.variants ?? null,
    rarities: query.rarities ?? null,
    excludeTokens: query.excludeTokens ?? false,
    refresh: query.refresh ?? false,
  };
}

export function summarizeGlobalSearchQuery(
  query: GlobalSearchQuery
): Record<string, unknown> {
  return {
    q: query.q.trim(),
    page: query.page,
    limit: query.limit,
    types: query.types ?? 'cards',
  };
}

export function logSearchCacheHit(fields: Record<string, unknown>): void {
  write('info', 'search.cache', fields);
}

export function logSearchPostgresQuery(fields: Record<string, unknown>): void {
  write('info', 'search.postgres.query', fields);
}

export function logSearchComplete(fields: Record<string, unknown>): void {
  write('info', 'search.complete', fields);
}

export function logSearchPipeline(fields: Record<string, unknown>): void {
  write('info', 'search.pipeline', fields);
}

export function logSearchGlobal(fields: Record<string, unknown>): void {
  write('info', 'search.global', fields);
}

export function logSearchReconcile(fields: Record<string, unknown>): void {
  write('warn', 'search.reconcile', fields);
}

export type HydrationTimings = {
  colorsMs: number;
  pricesMs: number;
  mapMs: number;
};

export function summarizeHydrationTimings(
  timings: HydrationTimings
): Record<string, number> {
  const colorsMs = roundMs(timings.colorsMs);
  const pricesMs = roundMs(timings.pricesMs);
  const mapMs = roundMs(timings.mapMs);
  const hydrateMs = roundMs(Math.max(colorsMs, pricesMs) + mapMs);
  return { colorsMs, pricesMs, mapMs, hydrateMs };
}
