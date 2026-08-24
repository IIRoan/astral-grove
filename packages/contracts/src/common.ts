import { z } from 'zod';

export const IsoDateString = z.string().date();

export const IsoDateTimeString = z.string().datetime();

export const QueryBooleanString = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

export function dataResponse<TData extends z.ZodTypeAny>(data: TData) {
  return z.object({ data });
}

export function dataMetaResponse<TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny>(
  data: TData,
  meta: TMeta
) {
  return z.object({
    data,
    meta,
  });
}
