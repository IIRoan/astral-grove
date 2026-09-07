// Official Sentry SDKs need a numeric project id; errex uses a string name + tunnel.
export function parseErrexDsn(raw: string): {
  key: string;
  host: string;
  project: string;
} | null {
  try {
    const url = new URL(raw);
    const key = url.username.trim();
    const host = url.host.trim();
    const project = url.pathname.replace(/^\/+|\/+$/g, '').trim();
    if (!key || !host || !project) {
      return null;
    }
    return { key, host, project };
  } catch {
    return null;
  }
}

export type ErrexSentryOptions = {
  dsn: string;
  tunnel: string;
  environment: string;
  sendDefaultPii: false;
  tracesSampleRate: number;
};

export function getSentryOptions(
  rawDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? ''
): ErrexSentryOptions | null {
  if (!rawDsn) {
    return null;
  }

  const parsed = parseErrexDsn(rawDsn);
  if (!parsed) {
    return null;
  }

  const { key, host, project } = parsed;
  const isDev =
    typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

  return {
    dsn: `https://${key}@${host}/1`,
    tunnel: `https://${host}/api/${encodeURIComponent(project)}/envelope/?sentry_key=${encodeURIComponent(key)}`,
    environment: process.env.APP_VARIANT ?? (isDev ? 'development' : 'production'),
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}
