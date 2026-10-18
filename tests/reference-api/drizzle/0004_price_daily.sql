CREATE TABLE "price_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cardmarket_id" integer NOT NULL,
	"is_foil" boolean NOT NULL,
	"price_date" date NOT NULL,
	"provider" text DEFAULT 'cardmarket' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"low_price" numeric(12, 2),
	"market_price" numeric(12, 2),
	"mid_price" numeric(12, 2),
	"high_price" numeric(12, 2),
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "price_daily_unique_day_idx" ON "price_daily" USING btree ("cardmarket_id","is_foil","price_date");
--> statement-breakpoint
CREATE INDEX "price_daily_lookup_idx" ON "price_daily" USING btree ("cardmarket_id","is_foil","price_date");
--> statement-breakpoint
INSERT INTO "price_daily" (
	"cardmarket_id",
	"is_foil",
	"price_date",
	"provider",
	"currency",
	"low_price",
	"market_price",
	"mid_price",
	"high_price",
	"synced_at"
)
SELECT DISTINCT ON ("cardmarket_id", "is_foil", (("captured_at" AT TIME ZONE 'UTC')::date))
	"cardmarket_id",
	"is_foil",
	("captured_at" AT TIME ZONE 'UTC')::date,
	"provider",
	"currency",
	"low_price",
	"market_price",
	"mid_price",
	"high_price",
	"captured_at"
FROM "price_history"
ORDER BY "cardmarket_id", "is_foil", (("captured_at" AT TIME ZONE 'UTC')::date), "captured_at" DESC
ON CONFLICT DO NOTHING;
