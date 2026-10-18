const TRANSIENT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
]);

export function isTransientDbError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && !seen.has(current)) {
    seen.add(current);

    if (current instanceof Error) {
      const withCode = current as Error & { code?: string };
      if (withCode.code && TRANSIENT_ERROR_CODES.has(withCode.code)) {
        return true;
      }
      current = 'cause' in current ? current.cause : undefined;
      continue;
    }

    if (typeof current === 'object' && current !== null && 'code' in current) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code)) {
        return true;
      }
    }

    break;
  }

  return false;
}
