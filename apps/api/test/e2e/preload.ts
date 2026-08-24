import { afterAll, beforeAll, setDefaultTimeout } from 'bun:test';
import {
  teardownE2E,
  setupE2E,
  ensureCatalogSynced,
  ensurePricesSynced,
} from './support.js';

setDefaultTimeout(180_000);

beforeAll(async () => {
  process.env.CATALOG_PROBE_DISABLED = 'true';
  await setupE2E();
  if (process.env.E2E_SKIP_CATALOG_SYNC !== 'true') {
    await ensureCatalogSynced();
  }
  await ensurePricesSynced();
}, 300_000);

afterAll(async () => {
  await teardownE2E();
});
