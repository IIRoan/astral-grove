import { expect, test } from 'bun:test';
import {
  collectionInviteAcceptPath,
  collectionInviteLinkingPath,
} from './collection-invite-link';

test('invitation links stay on the current origin and encode token path separators', () => {
  for (const token of ['tok123', 'token/with?fragment#and%encoding']) {
    expect(collectionInviteLinkingPath(token)).toBe(
      `/invite/${encodeURIComponent(token)}`
    );
    expect(collectionInviteAcceptPath(token)).toBe(
      `/collection/invite/${encodeURIComponent(token)}`
    );
    expect(
      new URL(collectionInviteAcceptPath(token), 'https://app.example').origin
    ).toBe('https://app.example');
  }
});
