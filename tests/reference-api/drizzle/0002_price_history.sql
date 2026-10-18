CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cardmarket_id" integer NOT NULL,
	"is_foil" boolean NOT NULL,
	"provider" text DEFAULT 'cardmarket' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"low_price" numeric(12, 2),
	"market_price" numeric(12, 2),
	"mid_price" numeric(12, 2),
	"high_price" numeric(12, 2),
	"avg_1_day" numeric(12, 2),
	"avg_7_day" numeric(12, 2),
	"avg_30_day" numeric(12, 2),
	"upstream_last_updated" timestamp with time zone NOT NULL,
	"content_hash" char(64) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "price_history_unique_snapshot_idx" ON "price_history" USING btree ("cardmarket_id","is_foil","upstream_last_updated","content_hash");
--> statement-breakpoint
CREATE INDEX "price_history_cardmarket_foil_captured_idx" ON "price_history" USING btree ("cardmarket_id","is_foil","captured_at");
