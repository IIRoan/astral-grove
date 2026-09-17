import { File, Paths } from 'expo-file-system';
import { cardOcrFrame } from '@/modules/card-ocr-frame/src';
import { fetchWithApiWake } from '@/lib/api-fetch';
import { getApiUrl } from '@/lib/api-url';

/**
 * The artwork index the scanner matches camera frames against: one descriptor per
 * distinct catalog image, computed by the API and served as a single packed buffer.
 *
 * The descriptor is plain arithmetic rather than a learned embedding precisely so the
 * server can compute it (see `@riftbound/contracts/card-art`), which turns what used to
 * be a ~25MB download and a long on-device embedding job into a few hundred kilobytes
 * fetched once per catalog change. The scanner cannot recognize anything without it.
 */

export type CardArtIndexState = {
  /** False on builds whose native module predates artwork matching. */
  supported: boolean;
  ready: boolean;
  /** Printable images the installed index covers. */
  count: number;
  error: string | null;
};

type CachedMeta = {
  hash: string;
  descriptorVersion: number;
};

const metaFile = () => new File(Paths.cache, 'card-art-index.json');
const indexFile = () => new File(Paths.cache, 'card-art-index.bin');

const listeners = new Set<() => void>();
let state: CardArtIndexState = {
  supported: true,
  ready: false,
  count: 0,
  error: null,
};
let installedHash: string | null = null;
let running: Promise<void> | null = null;

function publish(next: Partial<CardArtIndexState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeCardArtIndex(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCardArtIndexState(): CardArtIndexState {
  return state;
}

/** An OTA update can land this JS on a binary that has no artwork matching yet. */
function isSupported(): boolean {
  return typeof cardOcrFrame.setArtIndex === 'function';
}

async function readCache(
  version: number
): Promise<{ hash: string; bytes: Uint8Array } | null> {
  try {
    const meta = metaFile();
    const data = indexFile();
    if (!meta.exists || !data.exists) return null;
    const cached = JSON.parse(await meta.text()) as CachedMeta;
    if (cached.descriptorVersion !== version || !cached.hash) return null;
    return { hash: cached.hash, bytes: await data.bytes() };
  } catch {
    // An unreadable cache is just an absent one.
    return null;
  }
}

function writeCache(meta: CachedMeta, bytes: Uint8Array) {
  try {
    const data = indexFile();
    const info = metaFile();
    if (!data.exists) data.create();
    if (!info.exists) info.create();
    // Bytes first: the meta is what claims they are complete.
    data.write(bytes);
    info.write(JSON.stringify(meta));
  } catch {
    // Not being able to cache only costs a download next time.
  }
}

/** Install a packed index, and report how much of the catalog it actually covers. */
function install(hash: string, bytes: Uint8Array): boolean {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const count = cardOcrFrame.setArtIndex(copy.buffer);
  if (count <= 0) return false;
  installedHash = hash;
  publish({ ready: true, count, error: null });
  return true;
}

async function download(
  version: number
): Promise<{ hash: string; bytes: Uint8Array } | null> {
  const res = await fetchWithApiWake(`${getApiUrl()}/api/v1/cards/art-index`, {
    headers: { Accept: 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`Card index request failed (${String(res.status)})`);

  const served = Number(res.headers.get('x-art-descriptor-version'));
  // A descriptor the binary cannot compute is not comparable with what the camera sees.
  if (served !== version) return null;

  const hash = (res.headers.get('etag') ?? '').replace(/"/g, '');
  return { hash, bytes: new Uint8Array(await res.arrayBuffer()) };
}

/**
 * Make sure the installed index matches `hash`, fetching and caching it if not.
 *
 * `hash` is the `artIndexHash` from the catalog meta; pass undefined when it is not
 * known yet and the served index is taken as current. Cheap to call again: a matching
 * hash returns without touching the filesystem or the network.
 */
export async function ensureCardArtIndex(hash: string | undefined): Promise<void> {
  if (!isSupported()) {
    publish({ supported: false, ready: false, error: null });
    return;
  }
  if (installedHash !== null && (hash === undefined || hash === installedHash)) return;
  if (running) return running;

  running = (async () => {
    const version = cardOcrFrame.descriptorVersion;
    try {
      const cached = await readCache(version);
      if (cached && (hash === undefined || cached.hash === hash)) {
        if (install(cached.hash, cached.bytes)) return;
      }

      const fetched = await download(version);
      if (!fetched) {
        publish({ error: 'This app version cannot read the current card index.' });
        return;
      }
      if (!install(fetched.hash, fetched.bytes)) {
        publish({ error: 'The card index could not be read.' });
        return;
      }
      writeCache({ hash: fetched.hash, descriptorVersion: version }, fetched.bytes);
    } catch {
      // Keep whatever is already installed; a stale index still recognizes most cards.
      publish({ error: state.ready ? null : 'Could not download the card index.' });
    }
    // Cleared in a callback rather than a `finally`: the body can settle before the
    // assignment above, and a stale promise here would swallow the next hash change.
  })().finally(() => {
    running = null;
  });

  return running;
}
