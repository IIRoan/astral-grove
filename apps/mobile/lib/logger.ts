type LogLevel = 'error' | 'warn' | 'info';

type LogFields = Record<string, unknown>;

const LOGGED_FAILURE = Symbol('loggedActionFailure');

function write(
  level: LogLevel,
  event: string,
  fields?: LogFields,
  cause?: Error
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    if (cause) {
      console.error(line, cause);
      return;
    }
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

function markLogged(error: unknown): void {
  if (typeof error !== 'object' || error === null) return;
  try {
    Object.defineProperty(error, LOGGED_FAILURE, {
      value: true,
      enumerable: false,
    });
  } catch {
    // ignore frozen/sealed errors
  }
}

export function wasActionFailureLogged(error: unknown): boolean {
  return typeof error === 'object' && error !== null && LOGGED_FAILURE in error;
}

export function logInfo(event: string, fields?: LogFields): void {
  write('info', event, fields);
}

/** Structured log for failed user actions (collection, wishlist, import, etc.). */
export function logActionFailure(
  action: string,
  error: unknown,
  context?: LogFields
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  markLogged(error);
  markLogged(err);
  write(
    'error',
    'action.failed',
    {
      action,
      message: err.message,
      name: err.name,
      stack: err.stack,
      ...context,
    },
    err
  );
}

/** Run a side effect; log instead of throwing so the caller action can still commit. */
export function logIfThrows(
  action: string,
  run: () => void,
  context?: LogFields
): void {
  try {
    run();
  } catch (error) {
    logActionFailure(action, error, context);
  }
}
