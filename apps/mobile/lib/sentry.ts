import * as Sentry from '@sentry/react-native';
import { getSentryOptions } from '@/lib/errex-dsn';

let initialized = false;

export function initSentry(): void {
  if (initialized) {
    return;
  }

  const options = getSentryOptions();
  if (!options) {
    return;
  }

  Sentry.init(options);
  initialized = true;
}

export { Sentry };
export { getSentryOptions, parseErrexDsn } from '@/lib/errex-dsn';
