import { describe, expect, test } from 'bun:test';
import { TtlCache } from '../../src/lib/ttl-cache.js';

describe('TtlCache', () => {
  test('returns stored values before TTL expires', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'hello');
    expect(cache.get('a')).toBe('hello');
  });

  test('expires entries after TTL', async () => {
    const cache = new TtlCache<string>(20);
    cache.set('a', 'hello');
    await Bun.sleep(30);
    expect(cache.get('a')).toBeUndefined();
  });

  test('has reflects presence without returning value', () => {
    const cache = new TtlCache<true>(1000);
    cache.set('checked', true);
    expect(cache.has('checked')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  test('evicts oldest entries when maxEntries is reached', () => {
    const cache = new TtlCache<string>(1000, 2);
    cache.set('a', 'one');
    cache.set('b', 'two');
    cache.set('c', 'three');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('two');
    expect(cache.get('c')).toBe('three');
  });

  test('evicts by total bytes when a size budget is set', () => {
    const cache = new TtlCache<Uint8Array>(1000, 10, {
      maxBytes: 8,
      sizeOf: (value) => value.byteLength,
    });
    cache.set('a', new Uint8Array(6));
    cache.set('b', new Uint8Array(6));
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')?.byteLength).toBe(6);
    expect(cache.byteLength).toBe(6);
  });

  test('does not cache a single value larger than maxBytes', () => {
    const cache = new TtlCache<Uint8Array>(1000, 10, {
      maxBytes: 8,
      sizeOf: (value) => value.byteLength,
    });
    cache.set('huge', new Uint8Array(16));
    expect(cache.get('huge')).toBeUndefined();
    expect(cache.byteLength).toBe(0);
  });
});
