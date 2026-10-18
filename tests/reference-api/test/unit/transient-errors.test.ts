import { describe, expect, test } from 'bun:test';
import { isTransientDbError } from '../../src/db/transient-errors.js';

describe('isTransientDbError', () => {
  test('detects transient error codes on Error instances', () => {
    const error = Object.assign(new Error('connection closed'), {
      code: 'CONNECTION_CLOSED',
    });
    expect(isTransientDbError(error)).toBe(true);
  });

  test('walks error.cause chains', () => {
    const root = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const wrapped = new Error('query failed', { cause: root });
    expect(isTransientDbError(wrapped)).toBe(true);
  });

  test('detects plain objects with transient codes', () => {
    expect(isTransientDbError({ code: 'ECONNRESET' })).toBe(true);
  });

  test('returns false for validation errors', () => {
    expect(isTransientDbError(new Error('duplicate key'))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});
