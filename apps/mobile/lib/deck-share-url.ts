/** Share origin: explicit web origin, else EXPO_PUBLIC_APP_URL / EXPO_DEV_SERVER_ORIGIN, else production. */
export function resolveAppOrigin(webOrigin?: string | null): string {
  const fromWeb = String(webOrigin ?? '')
    .trim()
    .replace(/\/$/, '');
  if (fromWeb.length > 0 && fromWeb !== 'null') {
    return fromWeb;
  }

  const fromEnv = String(
    process.env.EXPO_PUBLIC_APP_URL ?? process.env.EXPO_DEV_SERVER_ORIGIN ?? ''
  ).replace(/\/$/, '');
  if (fromEnv.length > 0) return fromEnv;

  return 'https://rift.solace.onl';
}

/** Path-only deck view href used inside the Expo Router app. */
export function deckSharePath(deckId: string): `/decks/${string}` {
  return `/decks/${encodeURIComponent(deckId)}`;
}

/** Absolute deck share URL; pass `webOrigin` on web so the link matches the current host. */
export function buildDeckShareUrl(deckId: string, webOrigin?: string | null): string {
  return `${resolveAppOrigin(webOrigin)}${deckSharePath(deckId)}`;
}
