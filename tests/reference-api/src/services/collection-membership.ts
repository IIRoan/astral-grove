import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { collectionMembers, collections } from '../db/schema.js';

type DbExecutor = Pick<Database, 'select' | 'insert' | 'transaction'>;

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === 'object' && current !== null && 'code' in current) {
      if ((current as { code?: string }).code === '23505') return true;
    }
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}

async function findMembership(
  executor: Pick<Database, 'select'>,
  userId: string
): Promise<{ collectionId: string; role: string } | null> {
  const [existing] = await executor
    .select({
      collectionId: collectionMembers.collectionId,
      role: collectionMembers.role,
    })
    .from(collectionMembers)
    .where(eq(collectionMembers.userId, userId))
    .limit(1);
  return existing ?? null;
}

/** Lazily create active collection membership; one row per authenticated user. */
export async function ensureCollectionMembership(
  db: DbExecutor,
  userId: string
): Promise<{ collectionId: string; role: string }> {
  const existing = await findMembership(db, userId);
  if (existing) {
    return existing;
  }

  const create = async (executor: Pick<Database, 'select' | 'insert'>) => {
    const again = await findMembership(executor, userId);
    if (again) {
      return again;
    }

    const [created] = await executor
      .insert(collections)
      .values({})
      .returning({ id: collections.id });
    if (!created) {
      throw new Error('Failed to create collection');
    }

    try {
      await executor.insert(collectionMembers).values({
        collectionId: created.id,
        userId,
        role: 'owner',
      });
    } catch (error) {
      // Concurrent first-request race: another request won the unique user_id index.
      if (!isUniqueViolation(error)) throw error;
      const recovered = await findMembership(executor, userId);
      if (recovered) return recovered;
      throw error;
    }

    return { collectionId: created.id, role: 'owner' };
  };

  return db.transaction(async (tx) => create(tx));
}
