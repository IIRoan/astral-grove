import {
  cardEmbeddingDocument,
  cosineSimilarity,
  SEARCH_STOPWORDS,
  normalizeSearchText,
  type PaLogicalCard,
} from '@riftbound/contracts';
import { eq, isNotNull, or, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { cards } from '../db/schema.js';
import { entityHash } from '../lib/hash.js';

export const LOCAL_EMBEDDING_MODEL = 'local-hash-v1';
export const LOCAL_EMBEDDING_DIM = 256;
export const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
export const VECTOR_SCORE_FLOOR = 0.12;
export const VECTOR_TOP_K = 50;

export type EmbeddingProviderName = 'local' | 'openai' | 'none';

export type EmbeddingEnv = {
  EMBEDDING_PROVIDER: EmbeddingProviderName;
  EMBEDDING_API_KEY?: string | undefined;
};

export type StoredEmbedding = {
  id: string;
  embedding: number[];
};

function fnv1a(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic hashed n-gram embedding — no API key, good enough for tests and synonym-free overlap. */
export function localEmbed(text: string, dim = LOCAL_EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = normalizeSearchText(text)
    .split(' ')
    .filter((token) => token.length > 1 && !SEARCH_STOPWORDS.has(token));
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const index = fnv1a(token) % dim;
    vec[index] = (vec[index] ?? 0) + 1;
    const next = tokens[i + 1];
    if (next) {
      const bigram = fnv1a(`${token} ${next}`) % dim;
      vec[bigram] = (vec[bigram] ?? 0) + 0.5;
    }
  }
  let norm = 0;
  for (const value of vec) norm += value * value;
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 1;
  return vec.map((value) => value * scale);
}

export function rankEmbeddings(
  query: number[],
  rows: readonly StoredEmbedding[],
  topK = VECTOR_TOP_K,
  floor = VECTOR_SCORE_FLOOR
): StoredEmbedding[] {
  return rows
    .map((row) => ({ row, score: cosineSimilarity(query, row.embedding) }))
    .filter(
      (entry) => entry.score >= floor && entry.row.embedding.length === query.length
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map((entry) => entry.row);
}

export class EmbeddingService {
  private cache: { key: string; rows: StoredEmbedding[] } | null = null;

  constructor(
    private readonly db: Database,
    private readonly provider: EmbeddingProviderName,
    private readonly apiKey: string | undefined
  ) {}

  isEnabled(): boolean {
    return this.provider !== 'none';
  }

  modelName(): string {
    if (this.provider === 'openai' && this.apiKey) return OPENAI_EMBEDDING_MODEL;
    return LOCAL_EMBEDDING_MODEL;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  async embedQuery(text: string): Promise<number[] | null> {
    if (!this.isEnabled()) return null;
    const doc = normalizeSearchText(text);
    if (!doc) return null;
    return this.embedText(doc);
  }

  async upsertCardEmbedding(card: PaLogicalCard): Promise<void> {
    if (!this.isEnabled()) return;
    const document = cardEmbeddingDocument(card);
    const model = this.modelName();
    const hash = entityHash({ model, document });
    const existing = await this.db.query.cards.findFirst({
      where: eq(cards.id, card.id),
      columns: { embeddedHash: true },
    });
    if (existing?.embeddedHash === hash) return;

    const embedding = await this.embedText(document);
    if (!embedding) return;

    await this.db
      .update(cards)
      .set({
        embedding,
        embeddingModel: model,
        embeddedHash: hash,
      })
      .where(eq(cards.id, card.id));
    this.invalidateCache();
  }

  async embedMissing(limit = 400): Promise<number> {
    if (!this.isEnabled()) return 0;
    const model = this.modelName();
    const rows = await this.db
      .select({
        id: cards.id,
        name: cards.name,
        type: cards.type,
        super: cards.super,
        tags: cards.tags,
        description: cards.description,
        effect: cards.effect,
        attachText: cards.attachText,
        embeddedHash: cards.embeddedHash,
      })
      .from(cards)
      .where(or(sql`${cards.embedding} is null`, sql`${cards.embeddedHash} is null`))
      .limit(limit);

    let updated = 0;
    for (const row of rows) {
      const document = cardEmbeddingDocument(row);
      const hash = entityHash({ model, document });
      if (row.embeddedHash === hash) continue;
      const embedding = await this.embedText(document);
      if (!embedding) continue;
      await this.db
        .update(cards)
        .set({
          embedding,
          embeddingModel: model,
          embeddedHash: hash,
        })
        .where(eq(cards.id, row.id));
      updated += 1;
    }
    if (updated > 0) this.invalidateCache();
    return updated;
  }

  async embeddingsForCatalog(catalogHash: string): Promise<StoredEmbedding[]> {
    if (!this.isEnabled()) return [];
    if (this.cache?.key === catalogHash) return this.cache.rows;

    const rows = await this.db
      .select({ id: cards.id, embedding: cards.embedding })
      .from(cards)
      .where(isNotNull(cards.embedding));

    const stored: StoredEmbedding[] = [];
    for (const row of rows) {
      if (!row.embedding || row.embedding.length === 0) continue;
      stored.push({ id: row.id, embedding: row.embedding });
    }
    this.cache = { key: catalogHash, rows: stored };
    return stored;
  }

  private async embedText(text: string): Promise<number[] | null> {
    if (this.provider === 'openai' && this.apiKey) {
      try {
        return await embedOpenAi(text, this.apiKey);
      } catch (error) {
        console.warn('OpenAI embeddings failed, using local hash:', error);
      }
    }
    if (this.provider === 'none') return null;
    return localEmbed(text);
  }
}

export function createEmbeddingService(
  db: Database,
  env: EmbeddingEnv
): EmbeddingService {
  return new EmbeddingService(db, env.EMBEDDING_PROVIDER, env.EMBEDDING_API_KEY);
}

export function summarizeSearchExtensions(names: readonly string[]): string {
  return `pg_trgm=${String(names.includes('pg_trgm'))} vector=${String(names.includes('vector'))} storage=real[]`;
}

export async function logSearchIndexStatus(query: {
  unsafe: (sql: string) => Promise<{ extname: string }[]>;
}): Promise<void> {
  try {
    const rows = await query.unsafe(
      `select extname from pg_extension where extname in ('pg_trgm', 'vector')`
    );
    console.log(
      `[search] extensions ${summarizeSearchExtensions(rows.map((row) => row.extname))}`
    );
  } catch (error) {
    console.warn('[search] extension probe failed:', error);
  }
}

async function embedOpenAi(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings HTTP ${String(response.status)}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('OpenAI embeddings response missing vector');
  }
  return embedding;
}
