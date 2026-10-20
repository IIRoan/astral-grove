import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { createHarness, testDatabase, waitFor } from './support';

setDefaultTimeout(60000);
const harness = createHarness();
const { sql } = harness;
afterAll(() => harness.stopServer());

test('requests recover when PostgreSQL terminates the idle pool connections', async () => {
  const applicationName = `pool-recovery-${crypto.randomUUID()}`;
  const database = new URL(testDatabase);
  database.searchParams.set('application_name', applicationName);
  const app = await harness.startServer({
    DATABASE_URL: database.toString(),
    DB_POOL_MAX: '2',
  });
  const user = await harness.signup(app, 'pool-recovery');
  const connections = () =>
    sql<
      { pid: number }[]
    >`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND application_name=${applicationName} AND state='idle'`;
  await waitFor(async () => (await connections()).length >= 2);
  const pids = (await connections()).map(({ pid }) => pid);
  const stopped =
    await sql`SELECT pg_terminate_backend(pid) AS stopped FROM pg_stat_activity WHERE datname=current_database() AND application_name=${applicationName} AND state='idle' AND pid=ANY(${pids})`;
  expect(stopped).toHaveLength(pids.length);
  expect(stopped.every((row) => row.stopped)).toBe(true);
  await waitFor(
    async () =>
      (
        await sql`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND application_name=${applicationName} AND pid=ANY(${pids})`
      ).length === 0
  );
  for (let request = 0; request < 3; request++) {
    const response = await app.fetch('/api/auth/get-session', {
      headers: { cookie: user.cookie },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).user.id).toBe(user.user.id);
  }
});
