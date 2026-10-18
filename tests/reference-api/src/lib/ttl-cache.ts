interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  bytes: number;
}

export type TtlCacheOptions<V> = {
  maxBytes?: number;
  sizeOf?: (value: V) => number;
};

export class TtlCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private currentBytes = 0;
  private readonly maxBytes: number | undefined;
  private readonly sizeOfValue: ((value: V) => number) | undefined;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    options?: TtlCacheOptions<V>
  ) {
    this.maxBytes = options?.maxBytes;
    this.sizeOfValue = options?.sizeOf;
  }

  get byteLength(): number {
    return this.currentBytes;
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.remove(key, entry);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    const incomingBytes = this.sizeOfValue?.(value) ?? 0;
    if (this.maxBytes != null && incomingBytes > this.maxBytes) {
      const existing = this.store.get(key);
      if (existing) this.remove(key, existing);
      return;
    }

    const existing = this.store.get(key);
    if (existing) this.remove(key, existing);

    this.evictUntilFits(incomingBytes);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
      bytes: incomingBytes,
    });
    this.currentBytes += incomingBytes;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    const entry = this.store.get(key);
    if (entry) this.remove(key, entry);
  }

  clear(): void {
    this.store.clear();
    this.currentBytes = 0;
  }

  private evictUntilFits(incomingBytes: number): void {
    while (
      this.store.size >= this.maxEntries ||
      (this.maxBytes != null && this.currentBytes + incomingBytes > this.maxBytes)
    ) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) return;
      const entry = this.store.get(oldest);
      if (!entry) return;
      this.remove(oldest, entry);
    }
  }

  private remove(key: string, entry: CacheEntry<V>): void {
    if (this.store.delete(key)) {
      this.currentBytes -= entry.bytes;
    }
  }
}
