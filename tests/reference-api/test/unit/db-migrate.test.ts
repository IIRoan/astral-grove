import { describe, expect, test } from 'bun:test';
import { isTransientDbError } from '../../src/db/transient-errors.js';

describe('isTransientDbError', () => {
  test('detects ETIMEDOUT on nested causes', () => {
    const root = new Error('Failed query');
    const timeout = Object.assign(new Error('connect timed out'), {
      code: 'ETIMEDOUT',
    });
    root.cause = timeout;

    expect(isTransientDbError(root)).toBe(true);
  });

  test('detects postgres connection lifecycle errors', () => {
    for (const code of [
      'CONNECTION_ENDED',
      'CONNECTION_CLOSED',
      'CONNECTION_DESTROYED',
      'CONNECT_TIMEOUT',
    ]) {
      const error = Object.assign(new Error(`write ${code}`), { code });
      expect(isTransientDbError(error)).toBe(true);
    }
  });

  test('ignores non-transient errors', () => {
    const error = Object.assign(new Error('syntax error'), { code: '42601' });
    expect(isTransientDbError(error)).toBe(false);
  });
});
