import { describe, expect, test } from 'bun:test';
import { DEFAULT_USER_SETTINGS, mergeUserSettings } from '@riftbound/contracts';

describe('mergeUserSettings', () => {
  test('keeps defaults for omitted fields', () => {
    expect(mergeUserSettings(DEFAULT_USER_SETTINGS, { theme: 'system' })).toEqual({
      theme: 'system',
      defaultLayout: 'list',
      gridCardSize: 'large',
    });
  });
});
