import { File, Paths } from 'expo-file-system';
import type { CardListItem } from '@riftbound/contracts';
import { cardOcrFrame } from '@/modules/card-ocr-frame/src';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

/**
 * The artwork index the scanner matches camera frames against: one embedding per
 * distinct catalog image, built on this device.
 *
 * On-device rather than served by the API because the embedding is Apple's, and its
 * vectors are only comparable with others from the same revision. Building here means
 * the reference side and the camera side always come out of the same model, and a new
 * card is one more image to embed rather than a server job to re-run.
 *
 * The scanner works without it — text recognition alone, as before — so the build runs
 * alongside scanning and only ever adds accuracy.
 */

/** Matches the confirm screen's art, so most of these are already cached upstream. */
const EMBED_WIDTH = 320;
// Reference embeddings share Vision resources with the live camera pipeline.
const CONCURRENCY = 2;
/** Checkpoint interval, so a build interrupted halfway resumes rather than restarts. */
const SAVE_EVERY = 150;
/** Progress is published in steps; per-image updates would re-render the camera. */
const PUBLISH_EVERY = 10;
/**
 * A partial index is worse than none: the nearest neighbour of a card that is not in it
 * is some other card, and a sibling printing's art would win by default. A few dead
 * images must not block the feature forever, though, hence not 100%.
 */
const MIN_COVERAGE = 0.95;

export type CardArtIndexState = {
  /** False on builds whose native module predates artwork matching. */
  supported: boolean;
  ready: boolean;
  done: number;
  total: number;
};

const metaFile = () => new File(Paths.cache, 'card-art-index.json');
const vectorFile = () => new File(Paths.cache, 'card-art-index.bin');

const vectors = new Map<string, Float32Array>();
const listeners = new Set<() => void>();
let state: CardArtIndexState = { supported: true, ready: false, done: 0, total: 0 };
let loaded = false;
let running = false;
let installedCount = -1;

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
  return (
    typeof cardOcrFrame.embedImage === 'function' &&
    typeof cardOcrFrame.setIndex === 'function'
  );
}

/** Row-major float32, in `keys` order — the layout the native side searches. */
function pack(keys: readonly string[]): Float32Array {
  const dimension = vectors.get(keys[0] ?? '')?.length ?? 0;
  const packed = new Float32Array(keys.length * dimension);
  keys.forEach((key, row) => packed.set(vectors.get(key)!, row * dimension));
  return packed;
}

async function load(version: string) {
  try {
    const meta = metaFile();
    const data = vectorFile();
    if (!meta.exists || !data.exists) return;

    const {
      version: storedVersion,
      dimension,
      keys,
    } = JSON.parse(await meta.text()) as {
      version: string;
      dimension: number;
      keys: string[];
    };
    const bytes = await data.bytes();
    // A different embedding revision, or a write that was cut short: start over.
    if (storedVersion !== version || bytes.byteLength !== keys.length * dimension * 4) {
      return;
    }

    // Copied out so the floats are aligned whatever offset the file bytes arrived at.
    const floats = new Float32Array(keys.length * dimension);
    new Uint8Array(floats.buffer).set(bytes);
    keys.forEach((key, row) =>
      vectors.set(key, floats.subarray(row * dimension, (row + 1) * dimension))
    );
  } catch {
    // An unreadable cache is just an empty one.
  }
}

function save(version: string) {
  try {
    const keys = [...vectors.keys()];
    if (keys.length === 0) return;
    const packed = pack(keys);
    const data = vectorFile();
    const meta = metaFile();
    if (!data.exists) data.create();
    if (!meta.exists) meta.create();
    // Vectors first: `load` checks their size against the keys written after them.
    data.write(new Uint8Array(packed.buffer));
    meta.write(
      JSON.stringify({ version, dimension: packed.length / keys.length, keys })
    );
  } catch {
    // Not being able to cache only costs a rebuild next time.
  }
}

/**
 * Bring the index up to date with the catalog and install it. Cheap to call again:
 * only images that have no vector yet are fetched, so a catalog sync costs a handful of
 * downloads and a failed image is simply retried on the next call.
 *
 * ponytail: runs to completion once started, even if the scanner closes (~25MB, once).
 * Make it cancellable if that download ever shows up as a complaint.
 */
export async function ensureCardArtIndex(
  items: readonly CardListItem[]
): Promise<void> {
  if (running || items.length === 0) return;
  if (!isSupported()) {
    publish({ supported: false });
    return;
  }

  running = true;
  try {
    const version = cardOcrFrame.embeddingVersion;
    if (!loaded) {
      await load(version);
      loaded = true;
    }

    const wanted = new Set(items.flatMap((card) => card.imageUrl ?? []));
    const missing = [...wanted].filter((key) => !vectors.has(key));
    const alreadyDone = wanted.size - missing.length;
    publish({ done: alreadyDone, total: wanted.size });

    let dimension = vectors.values().next().value?.length ?? 0;
    let embedded = 0;
    const queue = [...missing];
    const worker = async () => {
      for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        try {
          const vector = new Float32Array(
            await cardOcrFrame.embedImage(resolveImageUrl(key, { width: EMBED_WIDTH }))
          );
          dimension ||= vector.length;
          if (vector.length !== dimension) continue;
          vectors.set(key, vector);
          embedded += 1;
          if (embedded % SAVE_EVERY === 0) save(version);
          if (embedded % PUBLISH_EVERY === 0) {
            publish({ done: alreadyDone + embedded });
          }
        } catch {
          // Offline or a bad image: left missing, and retried on the next call.
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // Only what the catalog still lists: a withdrawn image should stop matching.
    for (const key of [...vectors.keys()]) if (!wanted.has(key)) vectors.delete(key);
    if (embedded > 0) save(version);

    const keys = [...vectors.keys()];
    const covered = keys.length >= wanted.size * MIN_COVERAGE;
    if (covered && (embedded > 0 || installedCount !== keys.length)) {
      cardOcrFrame.setIndex(keys, pack(keys).buffer as ArrayBuffer);
      installedCount = keys.length;
    }
    publish({ ready: covered, done: keys.length, total: wanted.size });
  } finally {
    running = false;
  }
}
