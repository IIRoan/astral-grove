import type { Env } from '../env.js';

function hostnameFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/** Shared registrable suffix (api.foo.example + app.foo.example → example.com). */
function sharedParentDomain(hosts: string[]): string | undefined {
  const partsList = hosts
    .map((host) => host.split('.').filter(Boolean))
    .filter((parts) => parts.length >= 3);

  if (partsList.length === 0) return undefined;

  let shared: string[] = [];
  const maxDepth = Math.min(...partsList.map((parts) => parts.length));

  for (let depth = 2; depth <= maxDepth; depth += 1) {
    const suffixes = new Set(partsList.map((parts) => parts.slice(-depth).join('.')));
    if (suffixes.size === 1) {
      shared = partsList[0]!.slice(-depth);
    }
  }

  return shared.length >= 2 ? shared.join('.') : undefined;
}

export function resolveAuthCookieDomain(env: Env): string | undefined {
  if (env.AUTH_COOKIE_DOMAIN) return env.AUTH_COOKIE_DOMAIN;
  if (env.NODE_ENV !== 'production') return undefined;

  const apiHost = hostnameFromUrl(env.BETTER_AUTH_URL);
  const frontendHosts = env.TRUSTED_ORIGINS.map(hostnameFromUrl).filter(
    (host): host is string => Boolean(host)
  );

  if (apiHost && frontendHosts.length > 0) {
    return sharedParentDomain([apiHost, ...frontendHosts]);
  }

  if (apiHost) {
    const parts = apiHost.split('.').filter(Boolean);
    if (parts.length >= 3) {
      return parts.slice(-2).join('.');
    }
  }

  return undefined;
}
