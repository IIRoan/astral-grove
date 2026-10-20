import { afterAll, beforeAll, expect, test, setDefaultTimeout } from 'bun:test';
import { createHarness, runCommand } from './support';

setDefaultTimeout(60000);
const harness = createHarness();
let app: Awaited<ReturnType<typeof harness.startServer>>;

beforeAll(async () => {
  app = await harness.startServer();
});
afterAll(async () => {
  await harness.stopServer();
});

test('startup preserves the known production migration checksum and rejects unknown history', async () => {
  const timestamp = 1789289486904;
  const current = 'b996aa55710fb04b8c04d4614c83681938993a0ffbf384cdc963e1fbb7326d5e';
  const legacy = '131e9b7202b99f05fbeec89c4ffe41acc22c334037df805c605d3eefe484fbc0';
  const unknown = '0'.repeat(64);
  const original = await harness.sql`
    SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at=${timestamp}
  `;
  expect(original).toHaveLength(1);
  expect(original[0]!.hash).toBe(current);
  try {
    await harness.sql`
      UPDATE drizzle.__drizzle_migrations SET hash=${legacy} WHERE created_at=${timestamp}
    `;
    const compatible = await runCommand(app.config, ['migrate']);
    expect(compatible.exitCode).toBe(0);
    expect(
      (
        await harness.sql`
        SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at=${timestamp}
      `
      )[0]!.hash
    ).toBe(legacy);

    await harness.sql`
      UPDATE drizzle.__drizzle_migrations SET hash=${unknown} WHERE created_at=${timestamp}
    `;
    const rejected = await runCommand(app.config, ['migrate']);
    expect(rejected.exitCode).not.toBe(0);
    expect(rejected.errors).toContain(
      'Migration checksum mismatch: 0013_graceful_speedball'
    );
    expect(
      (
        await harness.sql`
        SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at=${timestamp}
      `
      )[0]!.hash
    ).toBe(unknown);
  } finally {
    await harness.sql`
      UPDATE drizzle.__drizzle_migrations SET hash=${current} WHERE created_at=${timestamp}
    `;
  }
});
