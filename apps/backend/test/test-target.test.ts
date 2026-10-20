import { describe, expect, test } from 'bun:test';
import { requireLocalTestDatabase } from './test-target';

describe('test target guards', () => {
  test.each([
    undefined,
    'postgres://localhost/riftbound',
    'postgres://db.example/riftbound_test',
    'postgres://localhost/production',
    'https://localhost/riftbound_test',
    'postgres://localhost/riftbound_test?host=production.example',
    'postgres://localhost/riftbound_test?hostaddr=192.0.2.1',
    'postgres://localhost/riftbound_test?port=6543',
    'postgres://localhost/riftbound_test?dbname=production',
    'postgres://localhost/riftbound_test?database=production',
    'postgres://localhost/riftbound_test?%68ost=production.example',
  ])('refuses unsafe database %s', (value) => {
    expect(() => requireLocalTestDatabase(value)).toThrow();
  });
  test('allows isolated loopback databases', () => {
    expect(
      requireLocalTestDatabase(
        'postgres://test:test@127.0.0.1:5433/riftbound_test_port'
      )
    ).toContain('riftbound_test_port');
  });
});
