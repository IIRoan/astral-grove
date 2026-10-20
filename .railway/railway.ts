import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
  volume,
} from 'railway/iac';

export default defineRailway((ctx) => {
  if (!ctx.isEnvironment('riftbound')) {
    throw new Error('This rehearsal targets only the riftbound environment.');
  }

  const region = 'europe-west4-drams3a';
  const domain = 'rust-api-riftbound.up.railway.app';
  const webDomain = 'expo-web-riftbound.up.railway.app';
  const apiUrl = 'https://${{rust-api.RAILWAY_PUBLIC_DOMAIN}}';
  const webUrl = 'https://${{expo-web.RAILWAY_PUBLIC_DOMAIN}}';
  const databaseVolume = volume('postgres-volume', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region,
    sizeMB: 5000,
  });
  const database = postgres('Postgres', { region });

  const backend = service('rust-api', {
    source: github('IIRoan/astral-grove', {
      branch: 'rust-backend-rewrite',
      checkSuites: false,
    }),
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile.backend' },
    healthcheck: '/api/v1/health',
    healthcheckTimeout: 300,
    replicas: { [region]: 1 },
    deploy: {
      restartPolicyMaxRetries: 3,
    },
    networking: { serviceDomains: { [domain]: { port: 7000 } } },
    env: {
      ADMIN_SYNC_TOKEN: preserve(),
      AUTH_COOKIE_DOMAIN: '${{expo-web.RAILWAY_PUBLIC_DOMAIN}}',
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: webUrl,
      CATALOG_PROBE_DISABLED: 'true',
      CATALOG_WARMUP_ON_START: 'false',
      DATABASE_URL: database.env.DATABASE_URL,
      EMAIL_FROM: preserve(),
      EMAIL_FROM_NAME: preserve(),
      HOST: '::',
      NODE_ENV: 'production',
      PA_API_KEY: preserve(),
      PA_BASE_URL: preserve(),
      PORT: '7000',
      PUBLIC_APP_URL: webUrl,
      S3_ACCESS_KEY_ID: preserve(),
      S3_BUCKET: preserve(),
      S3_ENDPOINT: preserve(),
      S3_REGION: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
      STALWART_JMAP_PASSWORD: preserve(),
      STALWART_JMAP_URL: preserve(),
      STALWART_JMAP_USERNAME: preserve(),
      SYNC_CRON_ENABLED: 'false',
      TRUSTED_ORIGINS: `${apiUrl},${webUrl}`,
      TRUSTED_PROXY_CIDRS: '100.64.0.0/10,fd12::/16',
      _RJEM_MALLOC_CONF:
        'background_thread:true,narenas:2,dirty_decay_ms:1000,muzzy_decay_ms:1000',
    },
  });

  const expoWeb = service('expo-web', {
    source: github('IIRoan/astral-grove', {
      branch: 'rust-backend-rewrite',
      checkSuites: false,
    }),
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile.web' },
    healthcheck: '/health',
    healthcheckTimeout: 300,
    replicas: { [region]: 1 },
    networking: { serviceDomains: { [webDomain]: { port: 8080 } } },
    env: {
      BACKEND_URL: 'http://${{rust-api.RAILWAY_PRIVATE_DOMAIN}}:${{rust-api.PORT}}',
      EXPO_PUBLIC_API_URL: 'https://${{RAILWAY_PUBLIC_DOMAIN}}',
      EXPO_PUBLIC_SENTRY_DSN: preserve(),
      PORT: '8080',
      RAILPACK_BUN_VERSION: preserve(),
      RAILPACK_CONFIG_FILE: preserve(),
      RAILPACK_NODE_VERSION: preserve(),
      RAILPACK_SPA_OUTPUT_DIR: preserve(),
    },
  });

  return project('riftbound', {
    environments: ['riftbound'],
    resources: [database, databaseVolume, backend, expoWeb],
  });
});
