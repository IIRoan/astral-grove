import { ZodError } from 'zod';
import { RequestValidationError } from './request-validation.js';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export type ApiErrorResponse = {
  status: number;
  error: ApiErrorCode;
  message: string;
};

export function unauthorizedResponse(message = 'Sign in required'): ApiErrorResponse {
  return {
    status: 401,
    error: 'UNAUTHORIZED',
    message,
  };
}

export function notFoundResponse(message = 'Not found'): ApiErrorResponse {
  return {
    status: 404,
    error: 'NOT_FOUND',
    message,
  };
}

export function validationErrorResponse(
  message = 'Request validation failed'
): ApiErrorResponse {
  return {
    status: 422,
    error: 'VALIDATION_ERROR',
    message,
  };
}

export function internalErrorResponse(
  message = 'An unexpected error occurred'
): ApiErrorResponse {
  return {
    status: 500,
    error: 'INTERNAL_ERROR',
    message,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function isNotFoundMessage(message: string): boolean {
  return message.includes('not found') || message.includes('Not Found');
}

export function toApiErrorResponse(error: unknown): ApiErrorResponse {
  if (error instanceof RequestValidationError) {
    return validationErrorResponse();
  }

  if (error instanceof ZodError) {
    return internalErrorResponse();
  }

  const message = errorMessage(error);

  if (message === 'Unauthorized') {
    return unauthorizedResponse(message);
  }

  if (isNotFoundMessage(message)) {
    return notFoundResponse(message);
  }

  return internalErrorResponse();
}

export function apiErrorBody(response: ApiErrorResponse) {
  return { error: response.error, message: response.message };
}

export function setApiError(
  set: { status?: unknown },
  response: ApiErrorResponse
): ReturnType<typeof apiErrorBody> {
  set.status = response.status;
  return apiErrorBody(response);
}
