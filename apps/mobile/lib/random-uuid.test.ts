import { describe, expect, test } from 'bun:test';
import { randomUuid } from '@/lib/random-uuid';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function withMissingCrypto(run: () => void): void {
  const hadCrypto = Object.prototype.hasOwnProperty.call(globalThis, 'crypto');
  const previous = globalThis.crypto;
  try {
    Reflect.deleteProperty(globalThis, 'crypto');
  } catch {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
  try {
    run();
  } finally {
    if (hadCrypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: previous,
        configurable: true,
        writable: true,
      });
    } else {
      try {
        Reflect.deleteProperty(globalThis, 'crypto');
      } catch {
        Object.defineProperty(globalThis, 'crypto', {
          value: undefined,
          configurable: true,
          writable: true,
        });
      }
    }
  }
}

describe('randomUuid', () => {
  test('returns a UUID v4 when Web Crypto is available', () => {
    expect(randomUuid()).toMatch(UUID_V4);
  });

  test('returns a UUID v4 when Web Crypto is missing', () => {
    withMissingCrypto(() => {
      expect(randomUuid()).toMatch(UUID_V4);
    });
  });
});
