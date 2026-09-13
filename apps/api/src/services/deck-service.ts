import { and, desc, eq } from 'drizzle-orm';
import {
  DECK_VERSION_LIMIT,
  DEFAULT_DECK_VERSION_NAME,
  type DeckListItem,
  type DecksListQuery,
  type DeckVersionSummary,
  type StoredDeckPayload,
} from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { userDecks, userDeckVersions } from '../db/schema.js';
import type { PaClient } from '../upstream/pa-client.js';
import type { CardCacheService } from './card-cache.js';
import { DeckSyncService } from './deck-sync.js';

export class DeckReadOnlyError extends Error {
  constructor() {
    super('Imported Piltover Archive decks are read-only');
    this.name = 'DeckReadOnlyError';
  }
}

export class DeckVersionNotFoundError extends Error {
  constructor() {
    super('Deck version not found');
    this.name = 'DeckVersionNotFoundError';
  }
}

export class DeckLastVersionError extends Error {
  constructor() {
    super('Cannot delete the last remaining deck version');
    this.name = 'DeckLastVersionError';
  }
}

export class DeckVersionLimitError extends Error {
  constructor() {
    super(`A deck can have at most ${DECK_VERSION_LIMIT} versions`);
    this.name = 'DeckVersionLimitError';
  }
}

type OwnedDeckRow = {
  payload: StoredDeckPayload;
  activeVersionId: string | null;
};

type VersionRecord = {
  id: string;
  name: string;
  payload: StoredDeckPayload;
  createdAt: Date;
  updatedAt: Date;
};

function toOwnedItem(
  payload: StoredDeckPayload,
  version?: {
    versionId: string;
    versionName: string;
    versions?: DeckVersionSummary[];
  }
): DeckListItem {
  return {
    ...payload,
    source: 'owned',
    readOnly: false,
    ...(version
      ? {
        versionId: version.versionId,
        versionName: version.versionName,
        ...(version.versions ? { versions: version.versions } : {}),
      }
      : {}),
  };
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

export function createDeckVersionId(): string {
  return `dver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function mergeActivePayload(
  family: StoredDeckPayload,
  versionPayload: StoredDeckPayload
): StoredDeckPayload {
  return {
    ...versionPayload,
    id: family.id,
    name: family.name,
    description: family.description ?? '',
    createdAt: family.createdAt,
    ...(family.upstreamId ? { upstreamId: family.upstreamId } : {}),
    ...(family.importedFromId ? { importedFromId: family.importedFromId } : {}),
    ...(family.syncWarnings ? { syncWarnings: family.syncWarnings } : {}),
  };
}

export function payloadForNewVersion(
  family: StoredDeckPayload,
  source: StoredDeckPayload,
  updatedAt: number
): StoredDeckPayload {
  return {
    ...mergeActivePayload(family, source),
    updatedAt,
  };
}

function toVersionSummaries(
  rows: VersionRecord[],
  activeVersionId: string | null
): DeckVersionSummary[] {
  const summaries = rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    isActive: row.id === activeVersionId,
  }));
  summaries.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
  return summaries;
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

  private async listOwnedRows(userId: string): Promise<
    {
      payload: StoredDeckPayload;
      activeVersionId: string | null;
      versionName: string | null;
    }[]
  > {
    const rows = await this.db
      .select({
        payload: userDecks.payload,
        activeVersionId: userDecks.activeVersionId,
        versionName: userDeckVersions.name,
      })
      .from(userDecks)
      .leftJoin(
        userDeckVersions,
        and(
          eq(userDeckVersions.userId, userDecks.userId),
          eq(userDeckVersions.id, userDecks.activeVersionId)
        )
      )
      .where(eq(userDecks.userId, userId))
      .orderBy(desc(userDecks.updatedAt));

    return rows.map((row) => ({
      payload: row.payload as StoredDeckPayload,
      activeVersionId: row.activeVersionId,
      versionName: row.versionName,
    }));
  }

  private async listOwnedPayloads(userId: string): Promise<StoredDeckPayload[]> {
    const rows = await this.listOwnedRows(userId);
    return rows.map((row) => row.payload);
  }

  private async getOwnedRow(
    userId: string,
    deckId: string
  ): Promise<OwnedDeckRow | null> {
    const row = await this.db.query.userDecks.findFirst({
      where: and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)),
    });
    if (!row) return null;
    return {
      payload: row.payload as StoredDeckPayload,
      activeVersionId: row.activeVersionId,
    };
  }

  private async getOwnedPayload(
    userId: string,
    deckId: string
  ): Promise<StoredDeckPayload | null> {
    const row = await this.getOwnedRow(userId, deckId);
    return row?.payload ?? null;
  }

  private async listVersionRecords(
    userId: string,
    deckId: string
  ): Promise<VersionRecord[]> {
    const rows = await this.db
      .select({
        id: userDeckVersions.id,
        name: userDeckVersions.name,
        payload: userDeckVersions.payload,
        createdAt: userDeckVersions.createdAt,
        updatedAt: userDeckVersions.updatedAt,
      })
      .from(userDeckVersions)
      .where(
        and(eq(userDeckVersions.userId, userId), eq(userDeckVersions.deckId, deckId))
      )
      .orderBy(desc(userDeckVersions.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      payload: row.payload as StoredDeckPayload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async getVersionRecord(
    userId: string,
    deckId: string,
    versionId: string
  ): Promise<VersionRecord | null> {
    const row = await this.db.query.userDeckVersions.findFirst({
      where: and(
        eq(userDeckVersions.userId, userId),
        eq(userDeckVersions.deckId, deckId),
        eq(userDeckVersions.id, versionId)
      ),
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      payload: row.payload as StoredDeckPayload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async toOwnedDetail(
    userId: string,
    payload: StoredDeckPayload,
    activeVersionId: string | null
  ): Promise<DeckListItem> {
    const versions = await this.listVersionRecords(userId, payload.id);
    const active =
      versions.find((row) => row.id === activeVersionId) ?? versions[0] ?? null;
    if (!active) return toOwnedItem(payload);
    return toOwnedItem(payload, {
      versionId: active.id,
      versionName: active.name,
      versions: toVersionSummaries(versions, active.id),
    });
  }

  private ownedUpstreamIds(owned: StoredDeckPayload[]): Set<string> {
    const ids = new Set<string>();
    for (const deck of owned) {
      if (deck.upstreamId) ids.add(deck.upstreamId);
      if (!deck.id.startsWith('deck_')) ids.add(deck.id);
    }
    return ids;
  }

  private async assertNotImported(deckId: string): Promise<void> {
    if (!this.deckSync) return;
    try {
      const imported = await this.deckSync.getStoredDeckPayload(deckId);
      if (imported) throw new DeckReadOnlyError();
    } catch (error) {
      if (error instanceof DeckReadOnlyError) throw error;
    }
  }

  private async syncUpstreamIfNeeded(
    payload: StoredDeckPayload,
    skipUpstreamSync?: boolean
  ): Promise<StoredDeckPayload> {
    if (!this.deckSync || skipUpstreamSync) return payload;
    try {
      const synced = await this.deckSync.upsertUpstreamDeck(payload);
      const upstreamId =
        synced.id !== payload.id
          ? synced.id
          : (payload.upstreamId ?? synced.upstreamId);
      return {
        ...payload,
        updatedAt: Math.max(payload.updatedAt, synced.updatedAt),
        ...(upstreamId ? { upstreamId } : {}),
      };
    } catch {
      return payload;
    }
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
    const ownedRows = await this.listOwnedRows(userId);
    const ownedItems =
      source === 'imported'
        ? []
        : ownedRows
          .filter((row) => matchesDeckQuery(row.payload, q))
          .map((row) =>
            toOwnedItem(
              row.payload,
              row.activeVersionId && row.versionName
                ? {
                  versionId: row.activeVersionId,
                  versionName: row.versionName,
                }
                : undefined
            )
          );

    const skipUpstreamIds = this.ownedUpstreamIds(ownedRows.map((row) => row.payload));
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
    const owned = await this.getOwnedRow(userId, deckId);
    if (owned) return this.toOwnedDetail(userId, owned.payload, owned.activeVersionId);

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
    const owned = await this.getOwnedRow(userId, deck.id);
    if (!owned) await this.assertNotImported(deck.id);

    const nextBase = deckPayloadForPersist(deck, owned?.payload ?? null, options);
    const next = await this.syncUpstreamIfNeeded(nextBase, options?.skipUpstreamSync);

    const now = new Date();
    const createdAt = new Date(next.createdAt);
    const versionId = owned?.activeVersionId ?? createDeckVersionId();
    const createVersion = !owned?.activeVersionId;

    await this.db.transaction(async (tx) => {
      await tx
        .insert(userDecks)
        .values({
          id: next.id,
          userId,
          name: next.name,
          description: next.description ?? '',
          payload: next,
          activeVersionId: versionId,
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
            ...(owned?.activeVersionId ? {} : { activeVersionId: versionId }),
          },
        });

      if (createVersion) {
        await tx.insert(userDeckVersions).values({
          id: versionId,
          userId,
          deckId: next.id,
          name: DEFAULT_DECK_VERSION_NAME,
          payload: next,
          createdAt,
          updatedAt: now,
        });
      } else {
        await tx
          .update(userDeckVersions)
          .set({ payload: next, updatedAt: now })
          .where(
            and(eq(userDeckVersions.userId, userId), eq(userDeckVersions.id, versionId))
          );
      }
    });

    const saved: StoredDeckPayload = {
      ...next,
      description: next.description ?? '',
      updatedAt: now.getTime(),
    };
    return this.toOwnedDetail(userId, saved, versionId);
  }

  async upsertVersion(
    userId: string,
    deckId: string,
    versionId: string,
    deck: StoredDeckPayload,
    options?: PersistOptions & { skipUpstreamSync?: boolean }
  ): Promise<DeckListItem> {
    const owned = await this.getOwnedRow(userId, deckId);
    if (!owned) {
      await this.assertNotImported(deckId);
      throw new DeckVersionNotFoundError();
    }

    const version = await this.getVersionRecord(userId, deckId, versionId);
    if (!version) throw new DeckVersionNotFoundError();

    const isActive = owned.activeVersionId === versionId;
    const nextBase = deckPayloadForPersist(deck, owned.payload, options);
    const next = isActive
      ? await this.syncUpstreamIfNeeded(nextBase, options?.skipUpstreamSync)
      : nextBase;
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(userDeckVersions)
        .set({ payload: next, updatedAt: now })
        .where(
          and(eq(userDeckVersions.userId, userId), eq(userDeckVersions.id, versionId))
        );

      if (isActive) {
        await tx
          .update(userDecks)
          .set({
            name: next.name,
            description: next.description ?? '',
            payload: next,
            updatedAt: now,
          })
          .where(and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)));
      }
    });

    const familyPayload = isActive
      ? { ...next, description: next.description ?? '', updatedAt: now.getTime() }
      : owned.payload;
    return this.toOwnedDetail(
      userId,
      familyPayload,
      isActive ? versionId : owned.activeVersionId
    );
  }

  async createVersion(
    userId: string,
    deckId: string,
    name: string
  ): Promise<DeckListItem> {
    const owned = await this.getOwnedRow(userId, deckId);
    if (!owned) {
      await this.assertNotImported(deckId);
      throw new DeckVersionNotFoundError();
    }

    const versions = await this.listVersionRecords(userId, deckId);
    if (versions.length >= DECK_VERSION_LIMIT) throw new DeckVersionLimitError();

    const source =
      versions.find((row) => row.id === owned.activeVersionId) ?? versions[0];
    const sourcePayload = source?.payload ?? owned.payload;
    const versionId = createDeckVersionId();
    const now = new Date();
    const copy = payloadForNewVersion(owned.payload, sourcePayload, now.getTime());

    await this.db.transaction(async (tx) => {
      await tx.insert(userDeckVersions).values({
        id: versionId,
        userId,
        deckId,
        name,
        payload: copy,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(userDecks)
        .set({
          name: copy.name,
          description: copy.description ?? '',
          payload: copy,
          activeVersionId: versionId,
          updatedAt: now,
        })
        .where(and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)));
    });

    return this.toOwnedDetail(userId, copy, versionId);
  }

  async renameVersion(
    userId: string,
    deckId: string,
    versionId: string,
    name: string
  ): Promise<DeckListItem> {
    const owned = await this.getOwnedRow(userId, deckId);
    if (!owned) {
      await this.assertNotImported(deckId);
      throw new DeckVersionNotFoundError();
    }

    const version = await this.getVersionRecord(userId, deckId, versionId);
    if (!version) throw new DeckVersionNotFoundError();

    const now = new Date();
    await this.db
      .update(userDeckVersions)
      .set({ name, updatedAt: now })
      .where(
        and(eq(userDeckVersions.userId, userId), eq(userDeckVersions.id, versionId))
      );

    return this.toOwnedDetail(userId, owned.payload, owned.activeVersionId);
  }

  async activateVersion(
    userId: string,
    deckId: string,
    versionId: string
  ): Promise<DeckListItem> {
    const owned = await this.getOwnedRow(userId, deckId);
    if (!owned) {
      await this.assertNotImported(deckId);
      throw new DeckVersionNotFoundError();
    }

    const version = await this.getVersionRecord(userId, deckId, versionId);
    if (!version) throw new DeckVersionNotFoundError();

    const next = mergeActivePayload(owned.payload, version.payload);
    const now = new Date();
    await this.db
      .update(userDecks)
      .set({
        payload: next,
        activeVersionId: versionId,
        updatedAt: now,
      })
      .where(and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)));

    return this.toOwnedDetail(userId, { ...next, updatedAt: now.getTime() }, versionId);
  }

  async deleteVersion(
    userId: string,
    deckId: string,
    versionId: string
  ): Promise<DeckListItem> {
    const owned = await this.getOwnedRow(userId, deckId);
    if (!owned) {
      await this.assertNotImported(deckId);
      throw new DeckVersionNotFoundError();
    }

    const versions = await this.listVersionRecords(userId, deckId);
    const target = versions.find((row) => row.id === versionId);
    if (!target) throw new DeckVersionNotFoundError();
    if (versions.length <= 1) throw new DeckLastVersionError();

    const siblings = versions.filter((row) => row.id !== versionId);
    const nextActive =
      owned.activeVersionId === versionId
        ? (siblings[0] ?? null)
        : (versions.find((row) => row.id === owned.activeVersionId) ?? siblings[0]);
    if (!nextActive) throw new DeckLastVersionError();

    const now = new Date();
    const familyPayload =
      nextActive.id === owned.activeVersionId
        ? owned.payload
        : mergeActivePayload(owned.payload, nextActive.payload);

    await this.db.transaction(async (tx) => {
      if (owned.activeVersionId === versionId) {
        await tx
          .update(userDecks)
          .set({
            payload: familyPayload,
            activeVersionId: nextActive.id,
            updatedAt: now,
          })
          .where(and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)));
      }
      await tx
        .delete(userDeckVersions)
        .where(
          and(eq(userDeckVersions.userId, userId), eq(userDeckVersions.id, versionId))
        );
    });

    return this.toOwnedDetail(
      userId,
      owned.activeVersionId === versionId
        ? { ...familyPayload, updatedAt: now.getTime() }
        : owned.payload,
      nextActive.id
    );
  }

  async delete(userId: string, deckId: string): Promise<boolean> {
    const owned = await this.getOwnedPayload(userId, deckId);
    if (!owned) {
      await this.assertNotImported(deckId);
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
