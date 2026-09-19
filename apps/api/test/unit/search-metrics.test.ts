import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  isSearchMetricsEnabled,
  logSearchComplete,
  summarizeCardsListQuery,
  summarizeHydrationTimings,
} from '../../src/lib/search-metrics.js';

describe('search metrics logging', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMetricsFlag = process.env.SEARCH_METRICS_LOG;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMetricsFlag === undefined) {
      delete process.env.SEARCH_METRICS_LOG;
    } else {
      process.env.SEARCH_METRICS_LOG = originalMetricsFlag;
    }
    mock.restore();
  });

  test('is enabled in development by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SEARCH_METRICS_LOG;
    expect(isSearchMetricsEnabled()).toBe(true);
  });

  test('is disabled in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SEARCH_METRICS_LOG;
    expect(isSearchMetricsEnabled()).toBe(false);

    process.env.SEARCH_METRICS_LOG = 'true';
    expect(isSearchMetricsEnabled()).toBe(true);
  });

  test('logSearchComplete emits structured JSON in dev', () => {
    process.env.NODE_ENV = 'development';
    const logSpy = mock(() => {});
    console.log = logSpy;

    logSearchComplete({
      path: 'cards_list',
      engine: 'postgres',
      dbMs: 12.5,
      hydrateMs: 24.1,
      totalMs: 40.2,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      event: string;
      subsystem: string;
      engine: string;
    };
    expect(payload.event).toBe('search.complete');
    expect(payload.subsystem).toBe('search');
    expect(payload.engine).toBe('postgres');
  });

  test('summarizeCardsListQuery strips blank q', () => {
    expect(
      summarizeCardsListQuery({
        q: '  vi  ',
        page: 1,
        limit: 40,
        sortBy: 'name',
        dir: 'asc',
        colorMode: 'all',
      })
    ).toEqual({
      q: 'vi',
      page: 1,
      limit: 40,
      sortBy: 'name',
      dir: 'asc',
      sets: null,
      types: null,
      colors: null,
      colorMode: 'all',
      super: null,
      variants: null,
      rarities: null,
      excludeTokens: false,
      refresh: false,
    });
  });

  test('summarizeHydrationTimings uses parallel max for hydrateMs', () => {
    expect(
      summarizeHydrationTimings({
        colorsMs: 10,
        pricesMs: 25,
        mapMs: 2,
      })
    ).toEqual({
      colorsMs: 10,
      pricesMs: 25,
      mapMs: 2,
      hydrateMs: 27,
    });
  });
});
