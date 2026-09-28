import { describe, expect, test } from 'bun:test';
import { adminAuthHeaders, apiJson } from './support.js';

describe('catalog and price sync', () => {
  test('sync status reflects a populated catalog cache', async () => {
    const status = await apiJson<{
      data: { catalog: { variantCount: number; hash: string } };
    }>('/api/v1/sync/status', { headers: adminAuthHeaders() });

    expect(status.data.catalog.variantCount).toBeGreaterThan(10);
    expect(status.data.catalog.hash.length).toBeGreaterThan(0);
  });

  test('sync status reflects cached Cardmarket prices', async () => {
    const status = await apiJson<{
      data: { prices: { rowCount: number; hash: string } };
    }>('/api/v1/sync/status', { headers: adminAuthHeaders() });

    expect(status.data.prices.rowCount).toBeGreaterThan(1000);
    expect(status.data.prices.hash.length).toBeGreaterThan(0);
  });

  test('force catalog sync upserts and leaves a usable variant count', async () => {
    const result = await apiJson<{
      data: {
        changed: boolean;
        pages: number;
        variantCount: number;
        hash: string;
      };
    }>('/api/v1/sync/catalog?force=1', {
      method: 'POST',
      headers: adminAuthHeaders(),
    });

    expect(result.data.changed).toBe(true);
    expect(result.data.pages).toBeGreaterThan(0);
    expect(result.data.variantCount).toBeGreaterThan(10);
    expect(result.data.hash.length).toBeGreaterThan(0);

    const after = await apiJson<{
      data: { catalog: { variantCount: number; hash: string } };
    }>('/api/v1/sync/status', { headers: adminAuthHeaders() });

    expect(after.data.catalog.variantCount).toBe(result.data.variantCount);
    expect(after.data.catalog.hash).toBe(result.data.hash);
  });
});
