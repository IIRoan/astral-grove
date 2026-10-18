type LogLevel = 'error' | 'warn' | 'info';

type LogFields = Record<string, unknown>;

function write(level: LogLevel, event: string, fields?: LogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logActionFailure(
  action: string,
  error: unknown,
  context?: LogFields
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  write('error', 'action.failed', {
    action,
    message: err.message,
    name: err.name,
    ...context,
  });
}
