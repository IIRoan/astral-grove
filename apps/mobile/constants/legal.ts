export const SUPPORT_EMAIL = 'support@solace.onl';

/** Riot Games' required notice for unofficial fan projects. */
export const RIOT_DISCLAIMER =
  "The Astral Grove isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, Riftbound and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

export function supportMailto(subject: string, body = ''): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
