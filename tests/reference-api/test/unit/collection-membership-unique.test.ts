import { describe, expect, test } from 'bun:test';
import { isUniqueViolation } from '../../src/services/collection-membership.js';

describe('collection membership unique violation detection', () => {
  test('recognizes postgres unique violations nested under cause', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(
      isUniqueViolation({ cause: { code: '23505', detail: 'Key (user_id) exists' } })
    ).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('nope'))).toBe(false);
  });
});
