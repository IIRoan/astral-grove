import { describe, expect, mock, test, beforeEach } from 'bun:test';

const Platform = { OS: 'ios' as string };
const openBrowserAsync = mock(async (_url: string) => ({ type: 'dismiss' as const }));
const openURL = mock(async (_url: string) => true);
const hapticPress = mock(async () => {});

mock.module('react-native', () => ({
  Platform,
  Linking: { openURL },
}));

mock.module('expo-web-browser', () => ({
  openBrowserAsync,
}));

mock.module('@/utils/haptics', () => ({
  hapticPress,
}));

const { isInAppBrowserOverlaySuspended, setInAppBrowserOverlaySuspended } =
  await import('@/lib/in-app-browser-overlay');
const { openExternalUrl } = await import('@/lib/open-external');

describe('openExternalUrl', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    setInAppBrowserOverlaySuspended(false);
    openBrowserAsync.mockClear();
    openURL.mockClear();
    hapticPress.mockClear();
    openBrowserAsync.mockImplementation(async () => ({ type: 'dismiss' }));
  });
  test('opens the in-app browser above a still-mounted iOS drawer overlay', async () => {
    Platform.OS = 'ios';
    setInAppBrowserOverlaySuspended(false);
    let overlayHiddenWhileBrowserOpen = false;
    openBrowserAsync.mockImplementation(async () => {
      overlayHiddenWhileBrowserOpen = isInAppBrowserOverlaySuspended();
      return { type: 'dismiss' };
    });

    await openExternalUrl(
      'https://www.cardmarket.com/en/Riftbound/Products?idProduct=1'
    );

    expect(openBrowserAsync).toHaveBeenCalled();
    expect(overlayHiddenWhileBrowserOpen).toBe(true);
    expect(isInAppBrowserOverlaySuspended()).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });

  test('resumes the drawer overlay if the in-app browser fails to open', async () => {
    Platform.OS = 'ios';
    setInAppBrowserOverlaySuspended(false);
    openBrowserAsync.mockImplementation(async () => {
      throw new Error('no browser');
    });

    await expect(openExternalUrl('https://example.com')).rejects.toThrow('no browser');
    expect(isInAppBrowserOverlaySuspended()).toBe(false);
  });

  test('uses Linking on web and does not touch the overlay', async () => {
    Platform.OS = 'web';
    setInAppBrowserOverlaySuspended(false);
    openBrowserAsync.mockImplementation(async () => {
      throw new Error('should not open in-app browser on web');
    });

    await openExternalUrl('https://example.com');

    expect(openURL).toHaveBeenCalledWith('https://example.com');
    expect(isInAppBrowserOverlaySuspended()).toBe(false);
  });
});
