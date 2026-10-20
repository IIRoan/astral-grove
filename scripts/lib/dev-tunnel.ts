import { z } from 'zod';

const LocalTunnel = z.object({
  tunnel: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  'credentials-file': z.string().min(1),
});

export function tunnelMode(input: {
  token?: string;
  hasLocalConfig: boolean;
  publicApiUrl?: string;
}): 'local' | 'external' | 'quick' {
  if (input.token) {
    throw new Error(
      'Remotely managed tunnel tokens cannot enforce local API-only ingress. Use a local credentials-file configuration or an API-only quick tunnel.'
    );
  }
  if (input.hasLocalConfig) return 'local';
  return input.publicApiUrl ? 'external' : 'quick';
}

export function apiOnlyTunnelConfig(raw: unknown, publicUrl: string, port: number) {
  const identity = LocalTunnel.parse(raw);
  const url = new URL(publicUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('PUBLIC_API_URL must be an HTTPS origin');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid API port');
  }
  return {
    ...identity,
    ingress: [
      {
        hostname: url.hostname,
        path: '^/api/(v1|auth)(/|$)',
        service: `http://127.0.0.1:${port}`,
      },
      { service: 'http_status:404' },
    ],
  };
}
