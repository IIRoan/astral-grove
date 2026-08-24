import type postgres from 'postgres';
import { isTransientDbError } from './transient-errors.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const CHAINABLE_QUERY_METHODS = new Set([
  'values',
  'raw',
  'simple',
  'describe',
  'cursor',
  'forEach',
]);

type QueryFactory = () => Promise<unknown>;

function sleep(ms: number): Promise<void> {
  return Bun.sleep(ms);
}

async function runWithRetry<T>(run: () => Promise<T>, maxAttempts: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(Math.min(attempt * 500, 3_000));
    }
  }

  throw lastError;
}

function wrapPendingQuery(
  createQuery: QueryFactory,
  maxAttempts: number
): Promise<unknown> {
  const chain: Array<
    (query: postgres.PendingQuery<readonly postgres.Row[]>) => unknown
  > = [];

  const buildQuery = () => {
    let query = createQuery() as postgres.PendingQuery<readonly postgres.Row[]>;
    for (const step of chain) {
      query = step(query) as postgres.PendingQuery<readonly postgres.Row[]>;
    }
    return query;
  };

  const execute = () => runWithRetry(() => buildQuery(), maxAttempts);

  const proxy = new Proxy({} as postgres.PendingQuery<readonly postgres.Row[]>, {
    get(_target, prop) {
      if (prop === 'then') {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => execute().then(onFulfilled, onRejected);
      }

      if (prop === 'catch') {
        return (onRejected?: (reason: unknown) => unknown) =>
          execute().catch(onRejected);
      }

      if (prop === 'finally') {
        return (onFinally?: () => void) => execute().finally(onFinally);
      }

      if (typeof prop === 'string' && CHAINABLE_QUERY_METHODS.has(prop)) {
        return (...args: unknown[]) => {
          chain.push((query) => {
            const method = (query as unknown as Record<string, unknown>)[prop];
            if (typeof method !== 'function') {
              throw new TypeError(`Query method ${prop} is not callable`);
            }
            return (method as (...methodArgs: unknown[]) => unknown).apply(query, args);
          });
          return proxy;
        };
      }

      const sample = buildQuery();
      const value = (sample as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(sample) : value;
    },
  });

  return proxy;
}

export function withPostgresRetry(
  client: postgres.Sql,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): postgres.Sql {
  return new Proxy(client, {
    apply(_target, _thisArg, args) {
      return wrapPendingQuery(
        () => Reflect.apply(client, undefined, args) as Promise<unknown>,
        maxAttempts
      );
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      if (prop === 'unsafe') {
        return (...args: Parameters<postgres.Sql['unsafe']>) =>
          wrapPendingQuery(() => target.unsafe(...args), maxAttempts);
      }

      return value.bind(target);
    },
  }) as postgres.Sql;
}
