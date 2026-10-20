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
    throw new Error('This configuration targets only the riftbound environment.');
  }

  const region = 'europe-west4-drams3a';
  const domain = 'rust-api-riftbound.up.railway.app';
  const webDomain = 'expo-web-riftbound.up.railway.app';
  const apiUrl = 'https://riftapi.solace.onl';
  const webUrl = 'https://rift.solace.onl';
  const databaseVolume = volume('postgres-volume', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region,
    sizeMB: 5000,
  });
  const database = postgres('Postgres', { region });

  const backend = service('rust-api', {
    cdn: { enabled: true },
    tracing: { enabled: true, autoInstrumentation: false },
    source: github('IIRoan/astral-grove', {
      branch: 'main',
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
    domains: [{ domain: 'riftapi.solace.onl', port: 7000 }],
    env: {
      ADMIN_SYNC_TOKEN: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: apiUrl,
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
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
      PUBLIC_APP_URL: webUrl,
      S3_ACCESS_KEY_ID: preserve(),
      S3_BUCKET: preserve(),
      S3_ENDPOINT: preserve(),
      S3_REGION: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
      STALWART_JMAP_PASSWORD: preserve(),
      STALWART_JMAP_URL: preserve(),
      STALWART_JMAP_USERNAME: preserve(),
      SYNC_CRON_ENABLED: 'true',
      TRUSTED_ORIGINS: `${webUrl},${apiUrl},https://${domain},https://${webDomain}`,
      TRUSTED_PROXY_CIDRS: '100.64.0.0/10,fd12::/16',
      _RJEM_MALLOC_CONF:
        'background_thread:true,narenas:2,dirty_decay_ms:1000,muzzy_decay_ms:1000',
    },
  });

  const expoWeb = service('expo-web', {
    cdn: { enabled: true },
    tracing: { enabled: true, autoInstrumentation: true },
    source: github('IIRoan/astral-grove', {
      branch: 'main',
      checkSuites: false,
    }),
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile.web' },
    healthcheck: '/health',
    healthcheckTimeout: 300,
    replicas: { [region]: 1 },
    networking: { serviceDomains: { [webDomain]: { port: 8080 } } },
    domains: [{ domain: 'rift.solace.onl', port: 8080 }],
    env: {
      BACKEND_URL: 'http://${{rust-api.RAILWAY_PRIVATE_DOMAIN}}:${{rust-api.PORT}}',
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_SENTRY_DSN: preserve(),
      PORT: '8080',
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
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
