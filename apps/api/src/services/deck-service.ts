import { and, desc, eq } from 'drizzle-orm';
import type {
  DeckListItem,
  DecksListQuery,
  StoredDeckPayload,
} from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { userDecks } from '../db/schema.js';
import type { PaClient } from '../upstream/pa-client.js';
import type { CardCacheService } from './card-cache.js';
import { DeckSyncService } from './deck-sync.js';

export class DeckReadOnlyError extends Error {
  constructor() {
    super('Imported Piltover Archive decks are read-only');
    this.name = 'DeckReadOnlyError';
  }
}

function toOwnedItem(payload: StoredDeckPayload): DeckListItem {
  return { ...payload, source: 'owned', readOnly: false };
}

function matchesDeckQuery(
  deck: Pick<StoredDeckPayload, 'name' | 'description' | 'legend' | 'champion'>,
  q: string
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    deck.name,
    deck.description ?? '',
    deck.legend?.name ?? '',
    deck.champion?.name ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function createOwnedDeckId(): string {
  return `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type PersistOptions = {
  /** Import path: keep server-assigned provenance. Client PUTs must omit this. */
  trustIncomingProvenance?: boolean;
};

/** Never persist client-supplied PA ids; only reuse stored or trusted import provenance. */
export function deckPayloadForPersist(
  incoming: StoredDeckPayload,
  stored: StoredDeckPayload | null,
  options?: PersistOptions
): StoredDeckPayload {
  const {
    upstreamId: incomingUpstreamId,
    importedFromId: incomingImportedFromId,
    ...rest
  } = incoming;
  const next: StoredDeckPayload = {
    ...rest,
    description: rest.description ?? '',
  };

  const importedFromId =
    stored?.importedFromId ??
    (options?.trustIncomingProvenance ? incomingImportedFromId : undefined);
  const upstreamId =
    stored?.upstreamId ??
    (options?.trustIncomingProvenance ? incomingUpstreamId : undefined);

  return {
    ...next,
    ...(importedFromId ? { importedFromId } : {}),
    ...(upstreamId ? { upstreamId } : {}),
  };
}

export class DeckService {
  private readonly deckSync: DeckSyncService | null;

  constructor(
    private readonly db: Database,
    pa?: PaClient,
    cardCache?: CardCacheService,
    upstreamDeckWriteExtraHeader?: { name: string; value: string }
  ) {
    this.deckSync =
      pa && cardCache
        ? new DeckSyncService(db, pa, cardCache, upstreamDeckWriteExtraHeader)
        : null;
  }

  private async listOwnedPayloads(userId: string): Promise<StoredDeckPayload[]> {
    const rows = await this.db
      .select({ payload: userDecks.payload })
      .from(userDecks)
      .where(eq(userDecks.userId, userId))
      .orderBy(desc(userDecks.updatedAt));

    return rows.map((row) => row.payload as StoredDeckPayload);
  }

  private async getOwnedPayload(
    userId: string,
    deckId: string
  ): Promise<StoredDeckPayload | null> {
    const row = await this.db.query.userDecks.findFirst({
      where: and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)),
    });
    if (!row) return null;
    return row.payload as StoredDeckPayload;
  }

  private ownedUpstreamIds(owned: StoredDeckPayload[]): Set<string> {
    const ids = new Set<string>();
    for (const deck of owned) {
      if (deck.upstreamId) ids.add(deck.upstreamId);
      if (!deck.id.startsWith('deck_')) ids.add(deck.id);
    }
    return ids;
  }

  async listForUser(
    userId: string,
    options?: DecksListQuery
  ): Promise<{
    items: DeckListItem[];
    total: number;
    owned: number;
    imported: number;
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const q = options?.q?.trim() ?? '';
    const source = options?.source ?? 'all';
    const ownedPayloads = await this.listOwnedPayloads(userId);
    const ownedItems =
      source === 'imported'
        ? []
        : ownedPayloads.filter((deck) => matchesDeckQuery(deck, q)).map(toOwnedItem);

    const skipUpstreamIds = this.ownedUpstreamIds(ownedPayloads);
    const importedItems: DeckListItem[] = [];
    let pagination:
      | {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrevious: boolean;
        }
      | undefined;

    if (this.deckSync && source !== 'owned') {
      try {
        const imported = await this.deckSync.listImportedDeckSummaries({
          skipIds: skipUpstreamIds,
          ...(options ? { query: options } : {}),
        });
        importedItems.push(...imported.items);
        pagination = imported.pagination;
      } catch {
        // Imported section is best-effort when upstream is unavailable.
      }
    }

    const items = [...ownedItems, ...importedItems];
    return {
      items,
      total: pagination?.total ?? items.length,
      owned: ownedItems.length,
      imported: importedItems.length,
      ...(pagination ? { pagination } : {}),
    };
  }

  async importFromUpstream(
    userId: string,
    sourceDeckId: string
  ): Promise<DeckListItem | null> {
    const ownedPayloads = await this.listOwnedPayloads(userId);
    const existing = ownedPayloads.find(
      (deck) =>
        deck.importedFromId === sourceDeckId ||
        deck.upstreamId === sourceDeckId ||
        deck.id === sourceDeckId
    );
    if (existing) return toOwnedItem(existing);

    if (!this.deckSync) return null;

    const imported = await this.deckSync.getStoredDeckPayload(sourceDeckId);
    if (!imported) return null;

    const now = Date.now();
    const copy: StoredDeckPayload = {
      ...imported,
      id: createOwnedDeckId(),
      upstreamId: sourceDeckId,
      importedFromId: sourceDeckId,
      createdAt: now,
      updatedAt: now,
    };

    return this.upsert(userId, copy, {
      trustIncomingProvenance: true,
      skipUpstreamSync: true,
    });
  }

  async getForUser(userId: string, deckId: string): Promise<DeckListItem | null> {
    const owned = await this.getOwnedPayload(userId, deckId);
    if (owned) return toOwnedItem(owned);

    if (!this.deckSync) return null;

    try {
      const imported = await this.deckSync.getImportedDeckListItem(deckId);
      if (!imported) return null;
      return imported;
    } catch {
      return null;
    }
  }

  async upsert(
    userId: string,
    deck: StoredDeckPayload,
    options?: PersistOptions & { skipUpstreamSync?: boolean }
  ): Promise<DeckListItem> {
    const owned = await this.getOwnedPayload(userId, deck.id);
    if (!owned && this.deckSync) {
      try {
        const imported = await this.deckSync.getStoredDeckPayload(deck.id);
        if (imported) throw new DeckReadOnlyError();
      } catch (error) {
        if (error instanceof DeckReadOnlyError) throw error;
      }
    }

    const nextBase = deckPayloadForPersist(deck, owned, options);
    let next: StoredDeckPayload = nextBase;

    if (this.deckSync && !options?.skipUpstreamSync) {
      try {
        const synced = await this.deckSync.upsertUpstreamDeck(next);
        const upstreamId =
          synced.id !== next.id ? synced.id : (next.upstreamId ?? synced.upstreamId);
        next = {
          ...next,
          updatedAt: Math.max(next.updatedAt, synced.updatedAt),
          ...(upstreamId ? { upstreamId } : {}),
        };
      } catch {
        // Local save still succeeds when upstream write is unavailable.
      }
    }

    const now = new Date();
    const createdAt = new Date(next.createdAt);

    await this.db
      .insert(userDecks)
      .values({
        id: next.id,
        userId,
        name: next.name,
        description: next.description ?? '',
        payload: next,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userDecks.userId, userDecks.id],
        set: {
          name: next.name,
          description: next.description ?? '',
          payload: next,
          updatedAt: now,
        },
      });

    return toOwnedItem({
      ...next,
      description: next.description ?? '',
      updatedAt: now.getTime(),
    });
  }

  async delete(userId: string, deckId: string): Promise<boolean> {
    const owned = await this.getOwnedPayload(userId, deckId);
    if (!owned) {
      if (this.deckSync) {
        try {
          const imported = await this.deckSync.getStoredDeckPayload(deckId);
          if (imported) throw new DeckReadOnlyError();
        } catch (error) {
          if (error instanceof DeckReadOnlyError) throw error;
        }
      }
      return false;
    }

    if (
      this.deckSync &&
      owned.upstreamId &&
      owned.upstreamId !== owned.importedFromId
    ) {
      try {
        await this.deckSync.deleteUpstreamDeck(owned.upstreamId);
      } catch {
        // Still remove the local copy when upstream delete fails.
      }
    }

    const deleted = await this.db
      .delete(userDecks)
      .where(and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)))
      .returning({ id: userDecks.id });
    return deleted.length > 0;
  }
}
