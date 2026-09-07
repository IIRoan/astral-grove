import type { ComponentType } from 'react';
import { getSentryOptions } from '@/lib/errex-dsn';
import { randomUuid } from '@/lib/random-uuid';

type StackFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
};

let tunnel: string | null = null;
let environment = 'production';
let initialized = false;

function eventId(): string {
  return randomUuid().replace(/-/g, '');
}

function framesFromStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const trimmed = line.trim();
    const withFn = /(?:at\s+)?(.+?)\s+\((.+?):(\d+):(\d+)\)/.exec(trimmed);
    if (withFn) {
      frames.push({
        function: withFn[1],
        filename: withFn[2],
        lineno: Number(withFn[3]),
        colno: Number(withFn[4]),
        in_app: true,
      });
      continue;
    }
    const bare = /(?:at\s+)?(.+?):(\d+):(\d+)/.exec(trimmed);
    if (!bare) continue;
    frames.push({
      filename: bare[1],
      lineno: Number(bare[2]),
      colno: Number(bare[3]),
      in_app: true,
    });
  }
  return frames.reverse();
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function buildExceptionEnvelope(
  error: unknown,
  env: string
): { header: string; item: string; body: string } {
  const err = toError(error);
  const id = eventId();
  const frames = framesFromStack(err.stack);
  const exceptionValue: Record<string, unknown> = {
    type: err.name || 'Error',
    value: err.message,
  };
  if (frames.length > 0) {
    exceptionValue.stacktrace = { frames };
  }
  const body = JSON.stringify({
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: env,
    exception: { values: [exceptionValue] },
  });
  return {
    header: JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }),
    item: JSON.stringify({
      type: 'event',
      content_type: 'application/json',
      length: body.length,
    }),
    body,
  };
}

async function postEnvelope(error: unknown): Promise<void> {
  if (!tunnel) return;
  const parts = buildExceptionEnvelope(error, environment);
  try {
    await fetch(tunnel, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: `${parts.header}\n${parts.item}\n${parts.body}\n`,
    });
  } catch {
    // Reporting must never break the app.
  }
}

function captureException(error: unknown): void {
  void postEnvelope(error);
}

function attachGlobalHandlers(): void {
  const errorUtils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler: () =>
          | ((error: Error, isFatal?: boolean) => void)
          | undefined;
        setGlobalHandler: (
          handler: (error: Error, isFatal?: boolean) => void
        ) => void;
      };
    }
  ).ErrorUtils;

  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      captureException(error);
      previous?.(error, isFatal);
    });
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('unhandledrejection', (event) => {
      captureException((event as { reason?: unknown }).reason);
    });
  }
}

export function initSentry(): void {
  if (initialized) return;
  const options = getSentryOptions();
  if (!options) return;
  tunnel = options.tunnel;
  environment = options.environment;
  attachGlobalHandlers();
  initialized = true;
}

export const Sentry = {
  captureException,
  wrap<T extends ComponentType<unknown>>(Component: T): T {
    return Component;
  },
};

export { getSentryOptions, parseErrexDsn } from '@/lib/errex-dsn';
