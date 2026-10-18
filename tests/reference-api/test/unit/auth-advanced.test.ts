import { describe, expect, test } from 'bun:test';
import {
  AUTH_IP_ADDRESS_HEADERS,
  resolveAuthAdvanced,
} from '../../src/lib/auth-advanced.js';

describe('resolveAuthAdvanced', () => {
  test('always trusts Railway X-Real-IP for rate limiting', () => {
    expect(AUTH_IP_ADDRESS_HEADERS).toEqual(['x-real-ip']);
    expect(resolveAuthAdvanced(undefined).ipAddress.ipAddressHeaders).toEqual([
      'x-real-ip',
    ]);
  });

  test('always sets HttpOnly SameSite cookies, even without a shared domain', () => {
    expect(resolveAuthAdvanced(undefined)).toEqual({
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
      defaultCookieAttributes: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
      },
    });
  });

  test('keeps cross-subdomain cookies alongside IP headers', () => {
    expect(resolveAuthAdvanced('solace.onl')).toEqual({
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
      defaultCookieAttributes: {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      },
      crossSubDomainCookies: {
        enabled: true,
        domain: 'solace.onl',
      },
    });
  });
});
