CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "embedding" real[];--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "embedding_model" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "embedded_hash" char(64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_name_trgm_idx" ON "cards" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_search_blob_trgm_idx" ON "cards" USING gin ((
  lower("name") || ' ' || lower(coalesce("type", '')) || ' ' ||
  lower(coalesce("super", '')) || ' ' || coalesce("tags"::text, '')
) gin_trgm_ops);
