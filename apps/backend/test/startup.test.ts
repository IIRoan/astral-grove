import { expect, test, setDefaultTimeout } from 'bun:test';
import { createServer, connect, type Socket } from 'node:net';
import { readFileSync } from 'node:fs';
import { createHarness, testDatabase } from './support';
setDefaultTimeout(60000);
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
