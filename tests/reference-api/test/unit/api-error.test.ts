import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { toApiErrorResponse } from '../../src/lib/api-error.js';
import { RequestValidationError } from '../../src/lib/request-validation.js';

describe('toApiErrorResponse', () => {
  test('maps request validation errors to 422 responses', () => {
    expect(
      toApiErrorResponse(
        new RequestValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: 'bad input',
              path: ['query', 'q'],
            },
          ])
        )
      )
    ).toEqual({
      status: 422,
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
  });

  test('maps plain zod errors to internal responses', () => {
    expect(
      toApiErrorResponse(
        new z.ZodError([
          {
            code: 'custom',
            message: 'response mismatch',
            path: ['data', 'id'],
          },
        ])
      )
    ).toEqual({
      status: 500,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  test('maps unauthorized errors to 401', () => {
    expect(toApiErrorResponse(new Error('Unauthorized'))).toEqual({
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  });

  test('maps not found errors to 404', () => {
    expect(toApiErrorResponse(new Error('Card not found'))).toEqual({
      status: 404,
      error: 'NOT_FOUND',
      message: 'Card not found',
    });
  });

  test('maps unknown errors to 500', () => {
    expect(toApiErrorResponse(new Error('database exploded'))).toEqual({
      status: 500,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });
});
