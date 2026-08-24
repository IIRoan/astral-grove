/** Canonical tab ids for bottom bar + side rail. */
export type AppTabId =
  'search' | 'collection' | 'wishlist' | 'decks' | 'play' | 'settings';

/** Active primary tab from pathname (`includes` so `/collection` and `/(tabs)/collection` both match). */
export function tabIdFromPathname(pathname: string): AppTabId {
  if (pathname.includes('/collection')) return 'collection';
  if (pathname.includes('/wishlist')) return 'wishlist';
  if (pathname.includes('/decks')) return 'decks';
  if (pathname.includes('/play')) return 'play';
  if (pathname.includes('/settings')) return 'settings';
  return 'search';
}
