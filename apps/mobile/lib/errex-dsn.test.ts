import { afterEach, describe, expect, test } from 'bun:test';
import { getSentryOptions, parseErrexDsn } from './errex-dsn';

describe('parseErrexDsn', () => {
  test('parses key, host, and string project name', () => {
    expect(
      parseErrexDsn(
        'https://2f67445264104af4b151e3400f3062bb@errors.solace.onl/astral-grove'
      )
    ).toEqual({
      key: '2f67445264104af4b151e3400f3062bb',
      host: 'errors.solace.onl',
      project: 'astral-grove',
    });
  });

  test('returns null for empty or invalid input', () => {
    expect(parseErrexDsn('')).toBeNull();
    expect(parseErrexDsn('not-a-url')).toBeNull();
    expect(parseErrexDsn('https://errors.solace.onl/astral-grove')).toBeNull();
  });
});

describe('getSentryOptions', () => {
  const prevVariant = process.env.APP_VARIANT;

  afterEach(() => {
    if (prevVariant === undefined) {
      delete process.env.APP_VARIANT;
    } else {
      process.env.APP_VARIANT = prevVariant;
    }
  });

  test('returns null when DSN is unset', () => {
    expect(getSentryOptions('')).toBeNull();
  });

  test('uses numeric stand-in DSN and errex tunnel', () => {
    process.env.APP_VARIANT = 'development';
    expect(
      getSentryOptions(
        'https://2f67445264104af4b151e3400f3062bb@errors.solace.onl/astral-grove'
      )
    ).toEqual({
      dsn: 'https://2f67445264104af4b151e3400f3062bb@errors.solace.onl/1',
      tunnel:
        'https://errors.solace.onl/api/astral-grove/envelope/?sentry_key=2f67445264104af4b151e3400f3062bb',
      environment: 'development',
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
  });
});
