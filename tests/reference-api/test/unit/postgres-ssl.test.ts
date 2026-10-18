import { describe, expect, test } from 'bun:test';
import { resolveSsl } from '../../src/db/client.js';

describe('resolveSsl', () => {
  test('requires TLS in production when sslmode is omitted', () => {
    expect(resolveSsl('postgres://riftbound:riftbound@db/riftbound', true)).toBe(
      'require'
    );
  });

  test('honors sslmode=disable even in production', () => {
    expect(
      resolveSsl('postgres://riftbound:riftbound@db/riftbound?sslmode=disable', true)
    ).toBeUndefined();
  });

  test('stays off in development unless sslmode asks for it', () => {
    expect(
      resolveSsl('postgres://riftbound:riftbound@db/riftbound', false)
    ).toBeUndefined();
    expect(
      resolveSsl('postgres://riftbound:riftbound@db/riftbound?sslmode=require', false)
    ).toBe('require');
  });
});
