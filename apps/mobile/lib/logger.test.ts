import { afterEach, describe, expect, test } from 'bun:test';
import { logActionFailure, logIfThrows, wasActionFailureLogged } from '@/lib/logger';

describe('logActionFailure', () => {
  const originalError = console.error;

  afterEach(() => {
    console.error = originalError;
  });

  test('emits the Error object so native reporters can capture it', () => {
    const logged: unknown[][] = [];
    console.error = ((...args: unknown[]) => {
      logged.push(args);
    }) as typeof console.error;

    const error = new Error('add failed');
    logActionFailure('collection.add', error, { variantNumber: 'OGN-001' });

    expect(logged).toHaveLength(1);
    expect(logged[0]?.[1]).toBe(error);
    expect(String(logged[0]?.[0])).toContain('"action":"collection.add"');
    expect(String(logged[0]?.[0])).toContain('"stack"');
  });

  test('logIfThrows logs and swallows so the caller is not rolled back', () => {
    const logged: unknown[][] = [];
    console.error = ((...args: unknown[]) => {
      logged.push(args);
    }) as typeof console.error;

    const error = new Error('Property crypto does not exist');
    expect(() => {
      logIfThrows(
        'collection.recent_activity',
        () => {
          throw error;
        },
        { variantNumber: 'UNL-205' }
      );
    }).not.toThrow();

    expect(logged).toHaveLength(1);
    expect(logged[0]?.[1]).toBe(error);
    expect(String(logged[0]?.[0])).toContain('"action":"collection.recent_activity"');
  });

  test('marks the error so callers can skip a duplicate log', () => {
    console.error = (() => { }) as typeof console.error;
    const error = new Error('already logged');
    logActionFailure('api.fetch', error);
    expect(wasActionFailureLogged(error)).toBe(true);
    expect(wasActionFailureLogged(new Error('fresh'))).toBe(false);
  });
});
