DELETE FROM "prices"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "cardmarket_id", "is_foil"
        ORDER BY "fetched_at" DESC, "id" DESC
      ) AS "rn"
    FROM "prices"
  ) AS "ranked"
  WHERE "rn" > 1
);--> statement-breakpoint
DROP INDEX "prices_cardmarket_foil_idx";--> statement-breakpoint
CREATE INDEX "collection_items_collection_updated_idx" ON "collection_items" USING btree ("collection_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "variants_variant_number_lower_idx" ON "variants" USING btree (lower("variant_number"));--> statement-breakpoint
CREATE UNIQUE INDEX "prices_cardmarket_foil_idx" ON "prices" USING btree ("cardmarket_id","is_foil");
