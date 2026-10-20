import { expect, test, setDefaultTimeout } from 'bun:test';
import { createServer, connect, type Socket } from 'node:net';
import { readFileSync } from 'node:fs';
import { createHarness, testDatabase, waitFor } from './support';
setDefaultTimeout(60000);
test('database pools retain warm connections after idle and respect small limits', async () => {
  const harness = createHarness();
  const pools = [];
  async function connectionCount(applicationName: string) {
    const rows = await harness.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE application_name = ${applicationName}
        AND backend_type = 'client backend'
    `;
    return rows[0]?.count ?? 0;
  }
  try {
    for (const { max, warm } of [
      { max: 1, warm: 1 },
      { max: 10, warm: 2 },
    ]) {
      const applicationName = `astral-pool-${crypto.randomUUID()}-${max}`;
      const target = new URL(testDatabase);
      target.searchParams.set('application_name', applicationName);
      const app = await harness.startServer({
        DATABASE_URL: target.toString(),
        DB_POOL_MAX: String(max),
      });
      pools.push({ app, applicationName, max, warm });
      await waitFor(async () => {
        const count = await connectionCount(applicationName);
        return count >= warm && count <= max;
      });
    }

    // Cross the old idle timeout and its cleanup interval without waking either API.
    await Bun.sleep(45_000);
    for (const { app, applicationName, max, warm } of pools) {
      const count = await connectionCount(applicationName);
      expect(count).toBeGreaterThanOrEqual(warm);
      expect(count).toBeLessThanOrEqual(max);
      expect((await app.fetch('/api/v1/health')).status).toBe(200);
    }
  } finally {
    await harness.stopServer();
  }
});
test('startup retries a transient PostgreSQL error and drains gracefully after recovery', async () => {
  const target = new URL(testDatabase);
  target.searchParams.set('sslmode', 'disable');
  const databasePort = Number(target.port || 5432);
  let rejected = false;
  const sockets = new Set<Socket>();
  const proxy = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    const upstream = connect({ host: '127.0.0.1', port: databasePort });
    sockets.add(upstream);
    upstream.on('close', () => sockets.delete(upstream));
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('data', (buffer) => socket.write(buffer));
    socket.on('data', (buffer) => {
      if (!rejected && buffer.toString().includes('BEGIN')) {
        rejected = true;
        const payload = Buffer.from(
          'SFATAL\0VFATAL\0C57P03\0Msynthetic startup retry\0\0'
        );
        const header = Buffer.alloc(5);
        header.write('E');
        header.writeInt32BE(payload.length + 4, 1);
        socket.end(Buffer.concat([header, payload]));
        upstream.destroy();
      } else upstream.write(buffer);
    });
  });
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing local proxy port');
  target.hostname = '127.0.0.1';
  target.port = String(address.port);
  const harness = createHarness();
  try {
    const app = await harness.startServer({ DATABASE_URL: target.toString() });
    expect((await app.fetch('/api/v1/health')).status).toBe(200);
    expect(readFileSync(app.logPath, 'utf8')).toContain('retrying');
    await harness.stopServer();
  } finally {
    try {
      await harness.stopServer();
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
  }
});
