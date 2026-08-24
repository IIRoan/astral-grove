import { z } from 'zod';

function parseCsv(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true';
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(7000),
  HOST: z.string().min(1).default('::'),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().max(50).optional(),
  PA_API_KEY: z.string().startsWith('ak_'),
  PA_BASE_URL: z.string().url().default('https://piltoverarchive.com/api/external'),
  ADMIN_SYNC_TOKEN: z.string().min(16),
  SYNC_CRON_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:7000'),

  /** When set, forwarded as partner id header on upstream deck create/delete (PA write auth quirk). */
  UPSTREAM_DECK_WRITE_EXTRA_HEADER_NAME: z.string().min(1).optional(),
  UPSTREAM_DECK_WRITE_EXTRA_HEADER_VALUE: z.string().min(1).optional(),
  AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
  TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((value) => parseCsv(value)),
  /** Public Expo web origin for shareable HTTPS invite links (/invite/:token). */
  PUBLIC_APP_URL: z.string().url().optional(),
  CATALOG_WARMUP_ON_START: z
    .string()
    .optional()
    .transform((value) => parseBooleanFlag(value, false)),
  /** Cardmarket `idGame` for daily price guide export (Riftbound = 22). */
  CARDMARKET_GAME_ID: z.coerce.number().int().positive().default(22),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).optional(),
  /** Stalwart JMAP over HTTPS (VPS edge); leave unset in tests/dev — Railway Hobby blocks SMTP 25/465/587. */
  STALWART_JMAP_URL: z.string().url().optional(),
  STALWART_JMAP_USERNAME: z.string().min(1).optional(),
  STALWART_JMAP_PASSWORD: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).optional(),
});

export type Env = Omit<z.infer<typeof EnvSchema>, 'PUBLIC_APP_URL'> & {
  PUBLIC_APP_URL: string;
};

/** Public web origin for email links; prefer PUBLIC_APP_URL, else a non-loopback BETTER_AUTH_URL. */
export function resolvePublicAppUrl(input: {
  publicAppUrl?: string;
  betterAuthUrl: string;
  nodeEnv: 'development' | 'production' | 'test';
}): string {
  if (input.publicAppUrl) {
    return input.publicAppUrl.replace(/\/+$/, '');
  }
  if (input.nodeEnv === 'production') {
    return 'https://rift.solace.onl';
  }
  try {
    const auth = new URL(input.betterAuthUrl);
    if (auth.hostname !== 'localhost' && auth.hostname !== '127.0.0.1') {
      return auth.origin;
    }
  } catch {}
  return 'http://localhost:7001';
}

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  const env = parsed.data;

  return {
    ...env,
    DB_POOL_MAX: env.DB_POOL_MAX ?? (env.NODE_ENV === 'production' ? 10 : 20),
    PUBLIC_APP_URL: resolvePublicAppUrl({
      ...(env.PUBLIC_APP_URL ? { publicAppUrl: env.PUBLIC_APP_URL } : {}),
      betterAuthUrl: env.BETTER_AUTH_URL,
      nodeEnv: env.NODE_ENV,
    }),
    CATALOG_WARMUP_ON_START:
      env.CATALOG_WARMUP_ON_START || env.NODE_ENV === 'development',
  };
}
