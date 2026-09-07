import {
  defineRailway,
  github,
  group,
  postgres,
  preserve,
  project,
  service,
  volume,
} from 'railway/iac';

export default defineRailway(() => {
  const astralGrove = github('IIRoan/astral-grove', { checkSuites: false });

  const testdb = postgres('testdb', { region: 'europe-west4-drams3a' });
  const postgresProduction = postgres('Postgres-production', {
    region: 'europe-west4-drams3a',
  });
  const postgresVolumeKjO = volume('postgres-volume-kjO-', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region: 'europe-west4-drams3a',
    sizeMB: 5000,
  });
  const postgresVolume = volume('postgres-volume', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region: 'europe-west4-drams3a',
    sizeMB: 5000,
  });

  const backend = service('backend', {
    source: astralGrove,
    healthcheck: '/api/v1/health',
    healthcheckTimeout: 300,
    replicas: { 'europe-west4-drams3a': 1 },
    deploy: { sleepApplication: true },
    domains: ['riftapi.solace.onl'],
    env: {
      ADMIN_SYNC_TOKEN: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      DATABASE_URL: preserve(),
      EMAIL_FROM: preserve(),
      EMAIL_FROM_NAME: preserve(),
      NODE_ENV: preserve(),
      PA_API_KEY: preserve(),
      PA_BASE_URL: preserve(),
      RAILPACK_BUN_VERSION: '1.4.2',
      RAILPACK_CONFIG_FILE: preserve(),
      S3_ACCESS_KEY_ID: preserve(),
      S3_BUCKET: preserve(),
      S3_ENDPOINT: preserve(),
      S3_REGION: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
      STALWART_JMAP_PASSWORD: preserve(),
      STALWART_JMAP_URL: preserve(),
      STALWART_JMAP_USERNAME: preserve(),
      SYNC_CRON_ENABLED: preserve(),
      TRUSTED_ORIGINS: preserve(),
    },
  });

  const expoWeb = service('expo-web', {
    source: astralGrove,
    replicas: { 'europe-west4-drams3a': 1 },
    deploy: {
      limitOverride: { containers: { cpu: 3, memoryBytes: 3_000_000_000 } },
      sleepApplication: false,
    },
    domains: [{ domain: 'rift.solace.onl', port: 8080 }],
    env: {
      EXPO_PUBLIC_API_URL: preserve(),
      RAILPACK_BUN_VERSION: '1.4.2',
      RAILPACK_CONFIG_FILE: preserve(),
      RAILPACK_SPA_OUTPUT_DIR: preserve(),
    },
  });

  const appServices = group('The Astral Grove', [backend, expoWeb]);
  const databases = group('Databases', [testdb, postgresProduction]);

  return project('riftbound', {
    resources: [
      databases,
      appServices,
      postgresVolumeKjO,
      postgresVolume,
    ],
  });
});
