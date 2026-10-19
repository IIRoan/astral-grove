import { afterEach, expect, mock, test } from 'bun:test';

mock.module('@/lib/auth-cookie', () => ({ getAuthCookieHeader: () => '' }));
mock.module('@/lib/api-url', () => ({ getApiUrl: () => 'http://api.test' }));
mock.module('@/lib/logger', () => ({ logActionFailure: mock() }));
const { remoteAddToCollection, remoteRemoveFromCollection } =
  await import('@/services/remoteCollectionService');
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

for (const adjust of [remoteAddToCollection, remoteRemoveFromCollection]) {
  test(`${adjust.name} does not apply a quantity delta twice after a gateway failure`, async () => {
    let writes = 0;
    globalThis.fetch = mock(async () => {
      writes++;
      return new Response(JSON.stringify({ error: 'gateway unavailable' }), {
        status: writes === 1 ? 503 : 200,
      });
    }) as typeof fetch;
    await expect(adjust('OGN-001', 1, false)).rejects.toMatchObject({ status: 503 });
    expect(writes).toBe(1);
  });
  test(`${adjust.name} does not retry a request whose response was lost`, async () => {
    let writes = 0;
    globalThis.fetch = mock(async () => {
      writes++;
      if (writes === 1) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify({ data: { ok: true } }));
    }) as typeof fetch;
    await expect(adjust('OGN-001', 1, false)).rejects.toThrow('Failed to fetch');
    expect(writes).toBe(1);
  });
}
