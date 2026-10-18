-- Allow separate standard and foil stacks for the same variant number
-- (foilMode=both without a distinct -Foil sibling SKU).
DROP INDEX IF EXISTS "collection_items_collection_variant_condition_lang_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collection_items_collection_variant_condition_lang_foil_idx"
  ON "collection_items" ("collection_id","variant_number","condition","language","is_foil");
