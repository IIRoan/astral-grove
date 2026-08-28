import { createApp, startCatalogMetadataWarmup, startSyncCrons } from './app.js';
import { runStartupMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';
import { logSearchIndexStatus } from './services/embeddings.js';

async function main() {
  const env = loadEnv();
  await runStartupMigrations(env);

  const ctx = createApp(env);
  await logSearchIndexStatus(ctx.client);
  const app = ctx.app;
  const port = env.PORT;
  const host = env.HOST;

  app.listen({ port, hostname: host });
  console.log(`Riftbound API running at http://${host}:${String(port)}`);

  startCatalogMetadataWarmup(ctx, env);
  startSyncCrons(ctx, env);

  const shutdown = () => {
    // Avoid client.end() on bun --watch: closing pool rejects in-flight queries and can crash hot reload.
    if (process.env.BUN_WATCH !== 'true') {
      void ctx.client.end({ timeout: 5 });
    }
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
