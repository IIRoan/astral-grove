/** Keep bearer invitations in the current app or HTTPS browser origin. */
export function collectionInviteAcceptPath(token: string): string {
  return `/collection/invite/${encodeURIComponent(token)}`;
}

export function collectionInviteLinkingPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}
