import type { z } from 'zod';

export class RequestValidationError extends Error {
  constructor(readonly cause: z.ZodError) {
    super('Request validation failed');
    this.name = 'RequestValidationError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeRequestBody(
  body: unknown,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return { ...(isPlainObject(body) ? body : {}), ...extra };
}

export function parseRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  throw new RequestValidationError(parsed.error);
}
