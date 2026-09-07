import { describe, expect, test } from 'bun:test';
import { buildExceptionEnvelope } from './sentry';

describe('buildExceptionEnvelope', () => {
  test('builds a sentry envelope body with the error message', () => {
    const parts = buildExceptionEnvelope(new Error('js-only errex test'), 'preview');
    expect(parts.item).toContain('"type":"event"');
    expect(parts.body).toContain('js-only errex test');
    expect(parts.body).toContain('"environment":"preview"');
    expect(parts.header).toContain('event_id');
  });
});
