import { describe, expect, test } from 'bun:test';
import { CollectionShareError } from '../../src/services/collection-share-service.js';

describe('CollectionShareError', () => {
  test('defaults to BAD_REQUEST code', () => {
    const error = new CollectionShareError('Invite expired');
    expect(error.name).toBe('CollectionShareError');
    expect(error.message).toBe('Invite expired');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.httpStatus).toBe(400);
  });

  test('preserves explicit error codes for route mapping', () => {
    expect(new CollectionShareError('Missing invite', 'NOT_FOUND').code).toBe(
      'NOT_FOUND'
    );
    expect(new CollectionShareError('Missing invite', 'NOT_FOUND').httpStatus).toBe(
      404
    );

    expect(new CollectionShareError('Already shared', 'CONFLICT').code).toBe(
      'CONFLICT'
    );
    expect(new CollectionShareError('Already shared', 'CONFLICT').httpStatus).toBe(409);

    expect(new CollectionShareError('Not the owner', 'FORBIDDEN').code).toBe(
      'FORBIDDEN'
    );
    expect(new CollectionShareError('Not the owner', 'FORBIDDEN').httpStatus).toBe(403);
  });
});
