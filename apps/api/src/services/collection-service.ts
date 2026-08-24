import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  chunkArray,
  COLLECTION_IMPORT_BATCH_SIZE,
  exportRowsToCsv,
  isVariantFoil,
  parseCollectionCsvToImportItems,
  type CollectionExportRow,
  type CollectionImportItem,
} from '@riftbound/contracts';
import type {
  CollectionItem as CollectionItemDto,
  CardCondition,
} from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { cards, collectionItems, sets, variants } from '../db/schema.js';
import { logActionFailure } from '../lib/logger.js';

import type { CardCacheService } from './card-cache.js';
import type { ImageStoreService } from './image-store.js';
import {
  CollectionAuditService,
  type CollectionAuditActorRef,
} from './collection-audit-service.js';
import { VariantResolver } from './variant-resolver.js';

/** foil_mode is finish availability, not "this row is foil"; only foil_only (or explicit foil sibling under both) counts as foil. */
export function isCollectionVariantFoil(
  foilMode: string,
  variantNumber: string,
  variantLabel: string,
  variantType?: string
): boolean {
  return isVariantFoil(foilMode, variantNumber, variantLabel, variantType);
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Next stack quantity after delta; callers treat <= 0 as delete this stack. */
export function nextStackQuantity(
  existingQuantity: number | undefined,
  delta: number
): number {
  return (existingQuantity ?? 0) + delta;
}

const STACK_CONFLICT_TARGET = [
  collectionItems.collectionId,
  collectionItems.variantNumber,
  collectionItems.condition,
  collectionItems.language,
  collectionItems.isFoil,
] as const;

export class CollectionService {
  private readonly variantResolver: VariantResolver;
  private readonly audit: CollectionAuditService;

  constructor(
    private readonly db: Database,
    cardCache: CardCacheService,
    private readonly images: ImageStoreService,
    pa: ConstructorParameters<typeof VariantResolver>[2],
    audit?: CollectionAuditService
  ) {
    this.variantResolver = new VariantResolver(db, cardCache, pa);
    this.audit = audit ?? new CollectionAuditService(db);
  }

  async listForCollection(collectionId: string): Promise<{
    items: CollectionItemDto[];
    total: number;
    totalQuantity: number;
  }> {
    const rows = await this.db
      .select({
        id: collectionItems.id,
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
        condition: collectionItems.condition,
        language: collectionItems.language,
        isFoil: collectionItems.isFoil,
        notes: collectionItems.notes,
        isGraded: collectionItems.isGraded,
        gradeCompany: collectionItems.gradeCompany,
        gradeScore: collectionItems.gradeScore,
        acquiredAt: collectionItems.acquiredAt,
        acquiredPriceCents: collectionItems.acquiredPriceCents,
        addedAt: collectionItems.addedAt,
        updatedAt: collectionItems.updatedAt,
        name: cards.name,
        imageUrl: variants.imageUrl,
        rarity: variants.rarity,
        variantLabel: variants.variantLabel,
        type: cards.type,
        setCode: sets.code,
      })
      .from(collectionItems)
      .innerJoin(variants, eq(collectionItems.variantNumber, variants.variantNumber))
      .innerJoin(cards, eq(variants.cardId, cards.id))
      .innerJoin(sets, eq(variants.setId, sets.id))
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(sql`${collectionItems.updatedAt} desc`);

    const items: CollectionItemDto[] = rows.map((row) => ({
      id: row.id,
      variantNumber: row.variantNumber,
      quantity: row.quantity,
      condition: row.condition as CardCondition,
      language: row.language,
      isFoil: row.isFoil,
      notes: row.notes,
      isGraded: row.isGraded,
      gradeCompany: row.gradeCompany,
      gradeScore: row.gradeScore,
      acquiredAt: toIso(row.acquiredAt),
      acquiredPriceCents: row.acquiredPriceCents,
      addedAt: row.addedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      name: row.name,
      imageUrl: this.images.rewriteImageUrl(row.imageUrl),
      setCode: row.setCode,
      rarity: row.rarity,
      type: row.type,
      variantLabel: row.variantLabel,
    }));

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    return { items, total: items.length, totalQuantity };
  }

  async quantitiesForVariants(
    collectionId: string,
    variantNumbers: string[]
  ): Promise<Array<{ variantNumber: string; isFoil: boolean; quantity: number }>> {
    const unique = [...new Set(variantNumbers)];
    if (unique.length === 0) return [];

    const rows = await this.db
      .select({
        variantNumber: collectionItems.variantNumber,
        isFoil: collectionItems.isFoil,
        quantity: collectionItems.quantity,
      })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          inArray(collectionItems.variantNumber, unique)
        )
      );

    const byFinish = new Map<
      string,
      { variantNumber: string; isFoil: boolean; quantity: number }
    >();
    for (const row of rows) {
      const isFoil = Boolean(row.isFoil);
      const key = `${row.variantNumber}\0${isFoil ? '1' : '0'}`;
      const existing = byFinish.get(key);
      if (existing) {
        existing.quantity += row.quantity;
      } else {
        byFinish.set(key, {
          variantNumber: row.variantNumber,
          isFoil,
          quantity: row.quantity,
        });
      }
    }

    const result: Array<{ variantNumber: string; isFoil: boolean; quantity: number }> =
      [];
    for (const variantNumber of unique) {
      const std = byFinish.get(`${variantNumber}\0${'0'}`);
      const foil = byFinish.get(`${variantNumber}\0${'1'}`);
      if (std) result.push(std);
      if (foil) result.push(foil);
      if (!std && !foil) {
        result.push({ variantNumber, isFoil: false, quantity: 0 });
      }
    }
    return result;
  }

  async upsert(
    collectionId: string,
    input: {
      variantNumber: string;
      quantity: number;
      condition: CardCondition;
      language: string;
      isFoil?: boolean;
      notes?: string | null;
      isGraded?: boolean;
      gradeCompany?: string | null;
      gradeScore?: string | null;
      acquiredAt?: string | null;
      acquiredPriceCents?: number | null;
    },
    actor?: CollectionAuditActorRef
  ): Promise<CollectionItemDto | null> {
    const isFoil = await this.resolveStackIsFoil(input.variantNumber, input.isFoil);
    const quantityBefore = await this.readStackQuantity(
      collectionId,
      input.variantNumber,
      input.condition,
      input.language,
      isFoil
    );

    if (input.quantity <= 0) {
      await this.remove(
        collectionId,
        input.variantNumber,
        input.condition,
        input.language,
        isFoil,
        actor
          ? {
              userId: actor.userId,
              action: actor.action === 'upsert' ? 'delete' : actor.action,
              ...(actor.metadata ? { metadata: actor.metadata } : {}),
            }
          : undefined,
        { skipAudit: false }
      );
      return null;
    }

    const acquiredAt = input.acquiredAt ? new Date(input.acquiredAt) : null;

    await this.db
      .insert(collectionItems)
      .values({
        collectionId,
        variantNumber: input.variantNumber,
        quantity: input.quantity,
        condition: input.condition,
        language: input.language,
        isFoil,
        notes: input.notes ?? null,
        isGraded: input.isGraded ?? false,
        gradeCompany: input.gradeCompany ?? null,
        gradeScore: input.gradeScore ?? null,
        acquiredAt,
        acquiredPriceCents: input.acquiredPriceCents ?? null,
      })
      .onConflictDoUpdate({
        target: [...STACK_CONFLICT_TARGET],
        set: {
          quantity: input.quantity,
          isFoil,
          notes: input.notes ?? null,
          isGraded: input.isGraded ?? false,
          gradeCompany: input.gradeCompany ?? null,
          gradeScore: input.gradeScore ?? null,
          acquiredAt,
          acquiredPriceCents: input.acquiredPriceCents ?? null,
          updatedAt: new Date(),
        },
      });

    if (actor && quantityBefore !== input.quantity) {
      await this.audit.record({
        collectionId,
        actorUserId: actor.userId,
        action: actor.action,
        variantNumber: input.variantNumber,
        condition: input.condition,
        language: input.language,
        isFoil,
        quantityBefore,
        quantityAfter: input.quantity,
        metadata: actor.metadata ?? null,
      });
    }

    return this.findStack(
      collectionId,
      input.variantNumber,
      input.condition,
      input.language,
      isFoil
    );
  }

  async adjustQuantity(
    collectionId: string,
    variantNumber: string,
    delta: number,
    options?: { condition?: CardCondition; language?: string; isFoil?: boolean },
    actor?: CollectionAuditActorRef
  ): Promise<CollectionItemDto | null> {
    const condition = options?.condition ?? 'near_mint';
    const language = options?.language ?? 'en';
    const isFoil = await this.resolveStackIsFoil(variantNumber, options?.isFoil);

    if (delta === 0) {
      return this.findStack(collectionId, variantNumber, condition, language, isFoil);
    }

    const quantityBefore = await this.readStackQuantity(
      collectionId,
      variantNumber,
      condition,
      language,
      isFoil
    );

    if (delta < 0) {
      const [updated] = await this.db
        .update(collectionItems)
        .set({
          quantity: sql`${collectionItems.quantity} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(collectionItems.collectionId, collectionId),
            eq(collectionItems.variantNumber, variantNumber),
            eq(collectionItems.condition, condition),
            eq(collectionItems.language, language),
            eq(collectionItems.isFoil, isFoil)
          )
        )
        .returning({ quantity: collectionItems.quantity });

      if (!updated) return null;
      if (updated.quantity <= 0) {
        await this.remove(
          collectionId,
          variantNumber,
          condition,
          language,
          isFoil,
          undefined,
          { skipAudit: true }
        );
        if (actor) {
          await this.audit.record({
            collectionId,
            actorUserId: actor.userId,
            action: actor.action,
            variantNumber,
            condition,
            language,
            isFoil,
            quantityBefore,
            quantityAfter: 0,
            metadata: actor.metadata ?? null,
          });
        }
        return null;
      }

      if (actor) {
        await this.audit.record({
          collectionId,
          actorUserId: actor.userId,
          action: actor.action,
          variantNumber,
          condition,
          language,
          isFoil,
          quantityBefore,
          quantityAfter: updated.quantity,
          metadata: actor.metadata ?? null,
        });
      }
      return this.findStack(collectionId, variantNumber, condition, language, isFoil);
    }

    await this.db
      .insert(collectionItems)
      .values({
        collectionId,
        variantNumber,
        quantity: delta,
        condition,
        language,
        isFoil,
      })
      .onConflictDoUpdate({
        target: [...STACK_CONFLICT_TARGET],
        set: {
          quantity: sql`${collectionItems.quantity} + ${delta}`,
          updatedAt: new Date(),
        },
      });

    const quantityAfter = quantityBefore + delta;
    if (actor) {
      await this.audit.record({
        collectionId,
        actorUserId: actor.userId,
        action: actor.action,
        variantNumber,
        condition,
        language,
        isFoil,
        quantityBefore,
        quantityAfter,
        metadata: actor.metadata ?? null,
      });
    }

    return this.findStack(collectionId, variantNumber, condition, language, isFoil);
  }

  private async resolveStackIsFoil(
    variantNumber: string,
    requested?: boolean
  ): Promise<boolean> {
    if (requested !== undefined) return requested;

    const [variant] = await this.db
      .select({
        variantNumber: variants.variantNumber,
        foilMode: variants.foilMode,
        variantLabel: variants.variantLabel,
        variantType: variants.variantType,
      })
      .from(variants)
      .where(eq(variants.variantNumber, variantNumber))
      .limit(1);

    if (!variant) {
      logActionFailure(
        'collection.resolve_finish.variant_not_found',
        new Error('Variant not found'),
        {
          variantNumber,
        }
      );
      throw new Error(`Variant ${variantNumber} not found`);
    }

    return isCollectionVariantFoil(
      variant.foilMode,
      variant.variantNumber,
      variant.variantLabel,
      variant.variantType
    );
  }

  private async findStack(
    collectionId: string,
    variantNumber: string,
    condition: CardCondition,
    language: string,
    isFoil: boolean
  ): Promise<CollectionItemDto | null> {
    const list = await this.listForCollection(collectionId);
    return (
      list.items.find(
        (item) =>
          item.variantNumber === variantNumber &&
          item.condition === condition &&
          item.language === language &&
          item.isFoil === isFoil
      ) ?? null
    );
  }

  async remove(
    collectionId: string,
    variantNumber: string,
    condition = 'near_mint',
    language = 'en',
    isFoil?: boolean,
    actor?: CollectionAuditActorRef,
    options?: { skipAudit?: boolean }
  ): Promise<void> {
    const finish =
      isFoil === undefined ? await this.resolveStackIsFoil(variantNumber) : isFoil;
    const quantityBefore = await this.readStackQuantity(
      collectionId,
      variantNumber,
      condition,
      language,
      finish
    );

    await this.db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.variantNumber, variantNumber),
          eq(collectionItems.condition, condition),
          eq(collectionItems.language, language),
          eq(collectionItems.isFoil, finish)
        )
      );

    if (actor && !options?.skipAudit && quantityBefore > 0) {
      await this.audit.record({
        collectionId,
        actorUserId: actor.userId,
        action: actor.action,
        variantNumber,
        condition,
        language,
        isFoil: finish,
        quantityBefore,
        quantityAfter: 0,
        metadata: actor.metadata ?? null,
      });
    }
  }

  async removeMany(collectionId: string, variantNumbers: string[]): Promise<void> {
    if (variantNumbers.length === 0) return;
    await this.db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          inArray(collectionItems.variantNumber, variantNumbers)
        )
      );
  }

  async batchSync(
    collectionId: string,
    items: Array<{
      variantNumber: string;
      quantity: number;
      condition: CardCondition;
      language: string;
      isFoil?: boolean | undefined;
      notes?: string | null | undefined;
      isGraded?: boolean | undefined;
      gradeCompany?: string | null | undefined;
      gradeScore?: string | null | undefined;
      acquiredAt?: string | null | undefined;
      acquiredPriceCents?: number | null | undefined;
    }>,
    actor?: CollectionAuditActorRef
  ): Promise<{ synced: number }> {
    let synced = 0;
    for (const item of items) {
      await this.upsert(
        collectionId,
        {
          variantNumber: item.variantNumber,
          quantity: item.quantity,
          condition: item.condition,
          language: item.language,
          ...(item.isFoil === undefined ? {} : { isFoil: item.isFoil }),
          notes: item.notes ?? null,
          isGraded: item.isGraded ?? false,
          gradeCompany: item.gradeCompany ?? null,
          gradeScore: item.gradeScore ?? null,
          acquiredAt: item.acquiredAt ?? null,
          acquiredPriceCents: item.acquiredPriceCents ?? null,
        },
        actor
      );
      synced += 1;
    }
    return { synced };
  }

  async exportForCollection(collectionId: string): Promise<string> {
    const rows = await this.db
      .select({
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
        condition: collectionItems.condition,
        language: collectionItems.language,
        isFoil: collectionItems.isFoil,
        notes: collectionItems.notes,
        gradeCompany: collectionItems.gradeCompany,
        gradeScore: collectionItems.gradeScore,
        name: cards.name,
        rarity: variants.rarity,
        variantType: variants.variantType,
        variantLabel: variants.variantLabel,
        setName: sets.name,
        setPrefix: sets.code,
      })
      .from(collectionItems)
      .innerJoin(variants, eq(collectionItems.variantNumber, variants.variantNumber))
      .innerJoin(cards, eq(variants.cardId, cards.id))
      .innerJoin(sets, eq(variants.setId, sets.id))
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(
        sql`${sets.code} asc`,
        sql`${collectionItems.variantNumber} asc`,
        sql`${collectionItems.condition} asc`
      );

    const exportRows: CollectionExportRow[] = rows.map((row) => ({
      variantNumber: row.variantNumber,
      cardName: row.name,
      setName: row.setName,
      setPrefix: row.setPrefix,
      rarity: row.rarity,
      variantType: row.variantType,
      variantLabel: row.variantLabel,
      isFoil: row.isFoil,
      quantity: row.quantity,
      language: row.language,
      condition: row.condition as CardCondition,
      gradeCompany: row.gradeCompany,
      gradeScore: row.gradeScore,
      notes: row.notes,
    }));

    return exportRowsToCsv(exportRows);
  }

  async clearAll(
    collectionId: string,
    actor?: CollectionAuditActorRef
  ): Promise<{ removed: number }> {
    const rows = await this.db
      .select({
        id: collectionItems.id,
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
        condition: collectionItems.condition,
        language: collectionItems.language,
        isFoil: collectionItems.isFoil,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
    if (rows.length === 0) {
      return { removed: 0 };
    }

    if (actor) {
      await this.audit.recordMany(
        rows.map((row) => ({
          collectionId,
          actorUserId: actor.userId,
          action: 'clear' as const,
          variantNumber: row.variantNumber,
          condition: row.condition,
          language: row.language,
          isFoil: row.isFoil,
          quantityBefore: row.quantity,
          quantityAfter: 0,
          metadata: {
            ...actor.metadata,
            removedStacks: rows.length,
          },
        }))
      );
    }

    await this.db
      .delete(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
    return { removed: rows.length };
  }

  async importCsv(
    collectionId: string,
    csv: string,
    actor?: CollectionAuditActorRef
  ): Promise<{
    imported: number;
    totalCopies: number;
    rowsProcessed: number;
    resolvedFromUpstream: number;
    failedRows: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    const parsed = parseCollectionCsvToImportItems(csv);
    if (parsed.errors.length > 0 && parsed.items.length === 0) {
      return {
        imported: 0,
        totalCopies: 0,
        rowsProcessed: parsed.rowsProcessed,
        resolvedFromUpstream: 0,
        failedRows: parsed.errors.length,
        errors: parsed.errors,
      };
    }

    const result = await this.importItems(collectionId, parsed.items, actor);
    return {
      ...result,
      rowsProcessed: parsed.rowsProcessed,
      errors: [...parsed.errors, ...result.errors],
      failedRows: parsed.errors.length + result.failedRows,
    };
  }

  async importItems(
    collectionId: string,
    items: CollectionImportItem[],
    actor?: CollectionAuditActorRef
  ): Promise<{
    imported: number;
    totalCopies: number;
    resolvedFromUpstream: number;
    failedRows: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    if (items.length === 0) {
      return {
        imported: 0,
        totalCopies: 0,
        resolvedFromUpstream: 0,
        failedRows: 0,
        errors: [],
      };
    }

    const variantNumbers = items.map((item) => item.variantNumber);
    const lookupBefore = await this.db
      .select({ variantNumber: variants.variantNumber })
      .from(variants)
      .where(inArray(variants.variantNumber, [...new Set(variantNumbers)]));
    const knownBefore = new Set(
      lookupBefore.map((row) => row.variantNumber.toLowerCase())
    );

    const lookup = await this.variantResolver.loadLookupMap(variantNumbers);
    const resolvedFromUpstream = [...new Set(variantNumbers)].filter(
      (vn) => !knownBefore.has(vn.toLowerCase()) && lookup.has(vn.toLowerCase())
    ).length;

    const validItems: CollectionImportItem[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    let failedRows = 0;

    for (const item of items) {
      const resolved = this.variantResolver.resolveVariantNumber(
        lookup,
        item.variantNumber
      );
      if (!resolved) {
        failedRows += 1;
        errors.push({
          row: 0,
          message: `Could not resolve variant: ${item.variantNumber}`,
        });
        continue;
      }
      validItems.push({ ...item, variantNumber: resolved });
    }

    let imported = 0;
    let totalCopies = 0;
    const importActor: CollectionAuditActorRef | undefined = actor
      ? {
          userId: actor.userId,
          action: 'import',
          ...(actor.metadata ? { metadata: actor.metadata } : {}),
        }
      : undefined;
    const chunks = chunkArray(validItems, COLLECTION_IMPORT_BATCH_SIZE);
    for (const chunk of chunks) {
      const result = await this.batchSync(collectionId, chunk, importActor);
      imported += result.synced;
      totalCopies += chunk.reduce((sum, item) => sum + item.quantity, 0);
    }

    return { imported, totalCopies, resolvedFromUpstream, failedRows, errors };
  }

  private async readStackQuantity(
    collectionId: string,
    variantNumber: string,
    condition: string,
    language: string,
    isFoil: boolean
  ): Promise<number> {
    const [row] = await this.db
      .select({ quantity: collectionItems.quantity })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.variantNumber, variantNumber),
          eq(collectionItems.condition, condition),
          eq(collectionItems.language, language),
          eq(collectionItems.isFoil, isFoil)
        )
      )
      .limit(1);
    return row?.quantity ?? 0;
  }
}
