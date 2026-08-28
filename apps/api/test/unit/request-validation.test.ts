import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  mergeRequestBody,
  parseRequest,
  RequestValidationError,
} from '../../src/lib/request-validation.js';

describe('parseRequest', () => {
  test('returns parsed data for valid input', () => {
    expect(parseRequest(z.object({ q: z.string() }), { q: 'ahri' })).toEqual({
      q: 'ahri',
    });
  });

  test('throws RequestValidationError for invalid input', () => {
    expect(() => parseRequest(z.object({ q: z.string().min(1) }), {})).toThrow(
      RequestValidationError
    );
  });
});

describe('mergeRequestBody', () => {
  test('overlays path params onto a JSON object body', () => {
    expect(mergeRequestBody({ quantity: 2 }, { variantNumber: 'OGN-001' })).toEqual({
      quantity: 2,
      variantNumber: 'OGN-001',
    });
  });

  test('treats missing or non-object bodies as empty', () => {
    expect(mergeRequestBody(undefined, { id: 'deck-1' })).toEqual({ id: 'deck-1' });
    expect(mergeRequestBody(null, { id: 'deck-1' })).toEqual({ id: 'deck-1' });
    expect(mergeRequestBody(['nope'], { id: 'deck-1' })).toEqual({ id: 'deck-1' });
  });
});
