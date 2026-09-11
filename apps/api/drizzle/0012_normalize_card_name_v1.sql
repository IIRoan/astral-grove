SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
SET LOCAL statement_timeout = '10min';
--> statement-breakpoint
-- Versioned name normalizer for stored generated columns.
-- unaccent is not inherently immutable. This wrapper is IMMUTABLE only under the
-- operational promise that public.unaccent's dictionary/rules stay fixed.
-- Do not alter unaccent's built-in volatility. A rules change requires a new
-- function version and recomputing stored columns, not CREATE OR REPLACE.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE FUNCTION public.normalize_card_name_v1(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both ' ' FROM regexp_replace(
    regexp_replace(
      lower(
        public.unaccent(
          'public.unaccent'::regdictionary,
          coalesce(input, '')
        )
      ),
      '[^a-z0-9[:space:]]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

COMMENT ON FUNCTION public.normalize_card_name_v1(text) IS
  'Search name normalizer v1. Immutable only while public.unaccent dictionary/rules remain unchanged. Bump the function name to recompute stored values.';
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "name_norm" text GENERATED ALWAYS AS (public.normalize_card_name_v1(name)) STORED;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "name_squashed" text GENERATED ALWAYS AS (replace(public.normalize_card_name_v1(name), ' ', '')) STORED;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "rules_search_text" text GENERATED ALWAYS AS (coalesce(description, '') || E'\n' || coalesce(effect, '') || E'\n' || coalesce(attach_text, '')) STORED;
--> statement-breakpoint
CREATE INDEX "cards_name_norm_trgm_idx" ON "cards" USING gin ("name_norm" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "cards_name_squashed_trgm_idx" ON "cards" USING gin ("name_squashed" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "cards_rules_search_text_trgm_idx" ON "cards" USING gin ("rules_search_text" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "cards_type_tokens_idx" ON "cards" USING gin (string_to_array(lower(trim("type")), ' '));
--> statement-breakpoint
CREATE INDEX "cards_super_lower_idx" ON "cards" USING btree (lower("super"));
--> statement-breakpoint
CREATE INDEX "variants_number_trgm_idx" ON "variants" USING gin (lower("variant_number") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "variants_label_trgm_idx" ON "variants" USING gin (lower("variant_label") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "variants_artist_trgm_idx" ON "variants" USING gin (lower(coalesce("artist", '')) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "variants_flavor_trgm_idx" ON "variants" USING gin ("flavor_text" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "variants_type_lower_idx" ON "variants" USING btree (lower("variant_type"));
