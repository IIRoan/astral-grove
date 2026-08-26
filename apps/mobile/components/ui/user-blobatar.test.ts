import { beforeEach, describe, expect, mock, test } from 'bun:test';

const Platform = { OS: 'ios' as string };

mock.module('react-native', () => ({
  Platform,
  View: 'View',
}));

mock.module('@blobatar/react-native', () => ({
  Blobatar: 'Blobatar',
}));

const { blobatarPlatformPassthrough } =
  await import('@/components/ui/user-blobatar-passthrough');

describe('blobatarPlatformPassthrough', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  test('native labels the Svg with title and omits RN a11y keys that leak on web', () => {
    expect(blobatarPlatformPassthrough('Ada')).toEqual({ title: 'Ada' });
    expect(blobatarPlatformPassthrough('Ada')).not.toHaveProperty(
      'importantForAccessibility'
    );
    expect(blobatarPlatformPassthrough('Ada')).not.toHaveProperty(
      'accessibilityElementsHidden'
    );
  });
});
