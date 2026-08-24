import type { z } from 'zod';

export class RequestValidationError extends Error {
  constructor(readonly cause: z.ZodError) {
    super('Request validation failed');
    this.name = 'RequestValidationError';
  }
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
