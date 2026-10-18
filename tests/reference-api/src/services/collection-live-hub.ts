import type {
  CollectionLiveChangeReason,
  CollectionLiveChangedEvent,
} from '@riftbound/contracts';

export type CollectionLiveListener = (event: CollectionLiveChangedEvent) => void;

/** In-process SSE fan-out for shared collections; multi-instance needs Redis or LISTEN/NOTIFY. */
export class CollectionLiveLimitError extends Error {
  constructor() {
    super('Too many live listeners');
    this.name = 'CollectionLiveLimitError';
  }
}

export class CollectionLiveHub {
  private readonly listeners = new Map<string, Set<CollectionLiveListener>>();

  constructor(private readonly maxPerCollection = 8) {}

  subscribe(collectionId: string, listener: CollectionLiveListener): () => void {
    let set = this.listeners.get(collectionId);
    if (!set) {
      set = new Set();
      this.listeners.set(collectionId, set);
    }
    if (set.size >= this.maxPerCollection) {
      throw new CollectionLiveLimitError();
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        this.listeners.delete(collectionId);
      }
    };
  }

  publish(
    collectionId: string,
    reason: CollectionLiveChangeReason,
    actorUserId: string
  ): void {
    const event: CollectionLiveChangedEvent = {
      type: 'collection.changed',
      collectionId,
      reason,
      actorUserId,
      at: new Date().toISOString(),
    };
    const set = this.listeners.get(collectionId);
    if (!set || set.size === 0) return;
    for (const listener of set) {
      listener(event);
    }
  }

  subscriberCount(collectionId: string): number {
    return this.listeners.get(collectionId)?.size ?? 0;
  }
}

export const collectionLiveHub = new CollectionLiveHub();
