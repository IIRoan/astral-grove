CREATE TABLE IF NOT EXISTS "card_art_fingerprints" (
	"image_key" text PRIMARY KEY NOT NULL,
	"descriptor_version" integer NOT NULL,
	"vector" text NOT NULL,
	"bits" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_art_fingerprints_version_idx" ON "card_art_fingerprints" USING btree ("descriptor_version");
