import { expect, test } from 'bun:test';
import { createHarness } from './support';

test('exports OTLP protobuf with environment credentials and flushes on SIGTERM', async () => {
  const harness = createHarness();
  const exports: Array<{ type: string | null; auth: string | null; body: Buffer }> = [];
  const collector = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      expect(new URL(request.url).pathname).toBe('/v1/traces');
      exports.push({
        type: request.headers.get('content-type'),
        auth: request.headers.get('authorization'),
        body: Buffer.from(await request.arrayBuffer()),
      });
      return new Response(null, { status: 200 });
    },
  });
  let stopped = false;
  try {
    const app = await harness.startServer({
      OTEL_EXPORTER_OTLP_ENDPOINT: collector.url.origin,
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
      OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Bearer%20synthetic-collector-token',
      OTEL_SERVICE_NAME: 'synthetic-railway-service',
      OTEL_SERVICE_VERSION: 'synthetic-commit-sha',
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
    });
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const parentId = '00f067aa0ba902b7';
    const response = await app.fetch('/api/v1/health?token=synthetic-query-secret', {
      headers: { traceparent: `00-${traceId}-${parentId}-01` },
    });
    expect(response.status).toBe(200);
    await harness.stopServer();
    stopped = true;
    expect(exports.length).toBeGreaterThan(0);
    for (const batch of exports) {
      expect(batch.type).toBe('application/x-protobuf');
      expect(batch.auth).toBe('Bearer synthetic-collector-token');
    }
    const body = Buffer.concat(exports.map((batch) => batch.body));
    expect(body.includes(Buffer.from(traceId, 'hex'))).toBe(true);
    expect(body.includes(Buffer.from(parentId, 'hex'))).toBe(true);
    for (const attribute of [
      'synthetic-railway-service',
      'synthetic-commit-sha',
      'astral-grove.sea-orm',
      'postgresql',
      'db.namespace',
      'db.operation.name',
      'GET /api/v1/health',
      'http.route',
    ]) {
      expect(body.includes(Buffer.from(attribute))).toBe(true);
    }
    expect(body.includes(Buffer.from('synthetic-query-secret'))).toBe(false);
    expect(body.includes(Buffer.from('synthetic-collector-token'))).toBe(false);
  } finally {
    if (!stopped) await harness.stopServer();
    collector.stop(true);
  }
}, 30_000);
