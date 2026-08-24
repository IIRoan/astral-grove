import { and, eq } from 'drizzle-orm';
import type { WishlistItem as WishlistItemDto } from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { cards, sets, variants, wishlistItems } from '../db/schema.js';
import type { ImageStoreService } from './image-store.js';

export class WishlistService {
  constructor(
    private readonly db: Database,
    private readonly images: ImageStoreService
  ) {}

  async listForUser(
    userId: string
  ): Promise<{ items: WishlistItemDto[]; total: number }> {
    const rows = await this.db
      .select({
        id: wishlistItems.id,
        variantNumber: wishlistItems.variantNumber,
        priority: wishlistItems.priority,
        targetPriceCents: wishlistItems.targetPriceCents,
        notes: wishlistItems.notes,
        addedAt: wishlistItems.addedAt,
        name: cards.name,
        imageUrl: variants.imageUrl,
        setCode: sets.code,
        rarity: variants.rarity,
        variantLabel: variants.variantLabel,
      })
      .from(wishlistItems)
      .innerJoin(variants, eq(wishlistItems.variantNumber, variants.variantNumber))
      .innerJoin(cards, eq(variants.cardId, cards.id))
      .innerJoin(sets, eq(variants.setId, sets.id))
      .where(eq(wishlistItems.userId, userId))
      .orderBy(wishlistItems.priority, wishlistItems.addedAt);

    const items: WishlistItemDto[] = rows.map((row) => ({
      id: row.id,
      variantNumber: row.variantNumber,
      priority: row.priority,
      targetPriceCents: row.targetPriceCents,
      notes: row.notes,
      addedAt: row.addedAt.toISOString(),
      name: row.name,
      imageUrl: this.images.rewriteImageUrl(row.imageUrl),
      setCode: row.setCode,
      rarity: row.rarity,
      variantLabel: row.variantLabel,
    }));

    return { items, total: items.length };
  }

  async upsert(
    userId: string,
    input: {
      variantNumber: string;
      priority?: number;
      targetPriceCents?: number | null;
      notes?: string | null;
    }
  ): Promise<WishlistItemDto> {
    const [variant] = await this.db
      .select({ variantNumber: variants.variantNumber })
      .from(variants)
      .where(eq(variants.variantNumber, input.variantNumber))
      .limit(1);

    if (!variant) {
      throw new Error(`Variant ${input.variantNumber} not found`);
    }

    await this.db
      .insert(wishlistItems)
      .values({
        userId,
        variantNumber: input.variantNumber,
        priority: input.priority ?? 0,
        targetPriceCents: input.targetPriceCents ?? null,
        notes: input.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [wishlistItems.userId, wishlistItems.variantNumber],
        set: {
          priority: input.priority ?? 0,
          targetPriceCents: input.targetPriceCents ?? null,
          notes: input.notes ?? null,
        },
      });

    const list = await this.listForUser(userId);
    const item = list.items.find((i) => i.variantNumber === input.variantNumber);
    if (!item) throw new Error('Wishlist item not found after upsert');
    return item;
  }

  async remove(userId: string, variantNumber: string): Promise<void> {
    await this.db
      .delete(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userId),
          eq(wishlistItems.variantNumber, variantNumber)
        )
      );
  }
}
