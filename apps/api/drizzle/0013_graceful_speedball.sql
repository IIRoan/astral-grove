CREATE TABLE "user_deck_versions" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"deck_id" text NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_deck_versions_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "user_decks" ADD COLUMN "active_version_id" text;--> statement-breakpoint
ALTER TABLE "user_deck_versions" ADD CONSTRAINT "user_deck_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deck_versions" ADD CONSTRAINT "user_deck_versions_deck_fk" FOREIGN KEY ("user_id","deck_id") REFERENCES "public"."user_decks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_deck_versions_deck_updated_idx" ON "user_deck_versions" USING btree ("user_id","deck_id","updated_at");
--> statement-breakpoint
INSERT INTO "user_deck_versions" ("id", "user_id", "deck_id", "name", "payload", "created_at", "updated_at")
SELECT
  'dver_' || replace(gen_random_uuid()::text, '-', ''),
  d."user_id",
  d."id",
  'Current',
  d."payload",
  d."created_at",
  d."updated_at"
FROM "user_decks" AS d
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_deck_versions" AS v
  WHERE v."user_id" = d."user_id"
    AND v."deck_id" = d."id"
);
--> statement-breakpoint
UPDATE "user_decks" AS d
SET "active_version_id" = v."id"
FROM (
  SELECT DISTINCT ON (v."user_id", v."deck_id")
    v."user_id",
    v."deck_id",
    v."id"
  FROM "user_deck_versions" AS v
  ORDER BY v."user_id", v."deck_id", v."updated_at" DESC, v."id" DESC
) AS v
WHERE v."user_id" = d."user_id"
  AND v."deck_id" = d."id"
  AND d."active_version_id" IS NULL;
