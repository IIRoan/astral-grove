import { exportDeckCode } from '@/lib/deck-codes';
import { buildDeckShareUrl } from '@/lib/deck-share-url';
import { exportDeckTts } from '@/lib/deck-tts';
import type { DeckState } from '@/lib/deck-types';

export type DeckShareFormat = 'link' | 'code' | 'tts';

export function resolveDeckSharePayload(
  deck: DeckState,
  format: DeckShareFormat,
  webOrigin?: string | null
): { ok: true; value: string } | { ok: false; error: string } {
  if (format === 'link') {
    return { ok: true, value: buildDeckShareUrl(deck.id, webOrigin) };
  }
  if (format === 'tts') {
    return { ok: true, value: exportDeckTts(deck) };
  }
  try {
    return { ok: true, value: exportDeckCode(deck) };
  } catch {
    return { ok: false, error: 'This deck cannot be encoded yet — check card codes.' };
  }
}
