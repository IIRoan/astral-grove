import { describe, expect, test } from 'bun:test';
import { withPostgresRetry } from '../../src/db/postgres-retry.js';

type MockQuery = Promise<unknown> & {
  values: () => MockQuery;
  raw: () => MockQuery;
};

function createMockQuery(
  run: () => Promise<unknown>,
  state: { mode?: 'values' | 'raw' } = {}
): MockQuery {
  const query = Object.assign(run(), {
    values() {
      state.mode = 'values';
      return query;
    },
    raw() {
      state.mode = 'raw';
      return query;
    },
  });
  return query;
}

describe('withPostgresRetry', () => {
  test('retries transient template queries', async () => {
    let attempts = 0;
    const client = Object.assign(
      () =>
        createMockQuery(async () => {
          attempts += 1;
          if (attempts < 3) {
            throw Object.assign(new Error('write CONNECTION_CLOSED'), {
              code: 'CONNECTION_CLOSED',
            });
          }
          return [{ ok: 1 }];
        }),
      { unsafe: async () => [{ ok: 1 }] }
    );

    const resilient = withPostgresRetry(client as never, 3);
    const result = await resilient`select 1`;

    expect(result).toEqual([{ ok: 1 }]);
    expect(attempts).toBe(3);
  });

  test('retries unsafe().values() chains used by drizzle', async () => {
    let attempts = 0;
    const client = Object.assign(async () => [{ ok: 1 }], {
      unsafe: () =>
        createMockQuery(async () => {
          attempts += 1;
          if (attempts < 2) {
            throw Object.assign(new Error('write CONNECTION_CLOSED'), {
              code: 'CONNECTION_CLOSED',
            });
          }
          return [['ok']];
        }),
    });

    const resilient = withPostgresRetry(client as never, 3);
    const chained = resilient.unsafe('select 1', []).values();

    expect(typeof chained.values).toBe('function');
    const result = await chained;

    expect(result).toEqual([['ok']]);
    expect(attempts).toBe(2);
  });
});
