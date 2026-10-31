/** Canonical tab ids for bottom bar + side rail. */
export type AppTabId =
  'search' | 'collection' | 'wishlist' | 'decks' | 'play' | 'fun' | 'settings';

/** Active primary tab from pathname (`includes` so `/collection` and `/(tabs)/collection` both match). */
export function tabIdFromPathname(pathname: string): AppTabId {
  if (pathname.includes('/collection')) return 'collection';
  if (pathname.includes('/wishlist')) return 'wishlist';
  if (pathname.includes('/decks')) return 'decks';
  if (pathname.includes('/play')) return 'play';
  if (pathname.includes('/fun')) return 'fun';
  if (pathname.includes('/settings')) return 'settings';
  return 'search';
}

/** Mobile tab bar has no Fun tab; Fun opens from Settings there. */
export function mobileTabIdFromPathname(pathname: string): AppTabId {
  const tab = tabIdFromPathname(pathname);
  return tab === 'fun' ? 'settings' : tab;
}
