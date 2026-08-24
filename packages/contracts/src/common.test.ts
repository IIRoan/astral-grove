import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  dataMetaResponse,
  dataResponse,
  IsoDateString,
  IsoDateTimeString,
  QueryBooleanString,
} from './common.js';

describe('QueryBooleanString', () => {
  test('parses true and false query values', () => {
    expect(QueryBooleanString.parse('true')).toBe(true);
    expect(QueryBooleanString.parse('false')).toBe(false);
  });

  test('rejects non-boolean query values', () => {
    expect(() => QueryBooleanString.parse('yes')).toThrow();
  });
});

describe('date helpers', () => {
  test('accept ISO date and datetime strings', () => {
    expect(IsoDateString.parse('2026-08-24')).toBe('2026-08-24');
    expect(IsoDateTimeString.parse('2026-08-24T09:21:00.000Z')).toBe(
      '2026-08-24T09:21:00.000Z'
    );
  });

  test('reject invalid date shapes', () => {
    expect(() => IsoDateString.parse('08/24/2026')).toThrow();
    expect(() => IsoDateTimeString.parse('2026-08-24 09:21:00')).toThrow();
  });
});

describe('response helpers', () => {
  test('builds data-only responses', () => {
    const schema = dataResponse(z.object({ ok: z.boolean() }));
    expect(schema.parse({ data: { ok: true } })).toEqual({ data: { ok: true } });
  });

  test('builds data and meta responses', () => {
    const schema = dataMetaResponse(z.array(z.string()), z.object({ total: z.number().int() }));
    expect(schema.parse({ data: ['a', 'b'], meta: { total: 2 } })).toEqual({
      data: ['a', 'b'],
      meta: { total: 2 },
    });
  });
});
