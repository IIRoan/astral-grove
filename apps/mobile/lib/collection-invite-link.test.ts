import { describe, expect, test } from 'bun:test';
import {
  buildCollectionInviteDeepLink,
  collectionInviteAcceptPath,
  collectionInviteLinkingPath,
  isLikelyMobileUserAgent,
} from './collection-invite-link';

describe('collection invite link helpers', () => {
  test('deep link embeds the invite token for the native app', () => {
    const token = 'invite-token-xyz';
    expect(buildCollectionInviteDeepLink(token)).toBe(
      `astral-grove://collection/invite/${token}`
    );
  });

  test('HTTPS linking path is /invite/:token', () => {
    expect(collectionInviteLinkingPath('tok123')).toBe('/invite/tok123');
  });

  test('web accept path is /collection/invite/:token', () => {
    expect(collectionInviteAcceptPath('tok123')).toBe('/collection/invite/tok123');
  });

  test('detects common mobile user agents', () => {
    expect(
      isLikelyMobileUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(true);
    expect(
      isLikelyMobileUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
      )
    ).toBe(true);
    expect(
      isLikelyMobileUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
    expect(isLikelyMobileUserAgent('')).toBe(false);
  });
});
