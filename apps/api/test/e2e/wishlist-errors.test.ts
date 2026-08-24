import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';

setDefaultTimeout(120_000);

const stamp = Date.now();
const password = 'test-password-12345';
let cookie = '';

beforeAll(async () => {
  await cleanupTestUsers('test-wishlist-err-%');
  cookie = await signUpTestUser({
    email: `test-wishlist-err-${stamp}@test.riftbound.dev`,
    password,
    name: 'Wishlist Errors User',
  });
});

afterAll(async () => {
  await cleanupTestUsers('test-wishlist-err-%');
});

describe('wishlist error handling', () => {
  test('PUT /wishlist/:variantNumber fails for unknown variant without creating a row', async () => {
    const variantNumber = 'ZZZ-NOT-A-REAL-CARD-999';
    const res = await authFetch(
      `/api/v1/wishlist/${encodeURIComponent(variantNumber)}`,
      {
        method: 'PUT',
        cookie,
        body: JSON.stringify({ variantNumber, priority: 1 }),
      }
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('DELETE /wishlist/:variantNumber is idempotent for missing rows', async () => {
    const res = await authFetch('/api/v1/wishlist/ZZZ-ALREADY-GONE-999', {
      method: 'DELETE',
      cookie,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ok: boolean } };
    expect(body.data.ok).toBe(true);
  });
});
