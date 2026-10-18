CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"collection_id" uuid NOT NULL,
	"inviter_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collection_invites" ADD CONSTRAINT "collection_invites_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collection_invites" ADD CONSTRAINT "collection_invites_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_members_user_id_idx" ON "collection_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "collection_members_collection_id_idx" ON "collection_members" USING btree ("collection_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_invites_token_idx" ON "collection_invites" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "collection_invites_collection_id_idx" ON "collection_invites" USING btree ("collection_id");
--> statement-breakpoint
CREATE INDEX "collection_invites_inviter_user_id_idx" ON "collection_invites" USING btree ("inviter_user_id");
--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "collection_id" uuid;
--> statement-breakpoint
-- Backfill: one personal collection per user who has items, then attach membership + items.
DO $$
DECLARE
  r RECORD;
  new_collection_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM collection_items WHERE collection_id IS NULL
  LOOP
    INSERT INTO collections DEFAULT VALUES RETURNING id INTO new_collection_id;
    INSERT INTO collection_members (collection_id, user_id, role)
      VALUES (new_collection_id, r.user_id, 'owner');
    UPDATE collection_items
      SET collection_id = new_collection_id
      WHERE user_id = r.user_id AND collection_id IS NULL;
  END LOOP;
END $$;
--> statement-breakpoint
-- Users with no items still need a personal collection container.
DO $$
DECLARE
  r RECORD;
  new_collection_id uuid;
BEGIN
  FOR r IN
    SELECT u.id AS user_id
    FROM "user" u
    WHERE NOT EXISTS (
      SELECT 1 FROM collection_members cm WHERE cm.user_id = u.id
    )
  LOOP
    INSERT INTO collections DEFAULT VALUES RETURNING id INTO new_collection_id;
    INSERT INTO collection_members (collection_id, user_id, role)
      VALUES (new_collection_id, r.user_id, 'owner');
  END LOOP;
END $$;
--> statement-breakpoint
-- Orphan item rows should not exist after backfill; delete any that somehow remain.
DELETE FROM collection_items WHERE collection_id IS NULL;
--> statement-breakpoint
ALTER TABLE "collection_items" ALTER COLUMN "collection_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "collection_items_user_variant_condition_lang_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "collection_items_user_id_idx";
--> statement-breakpoint
ALTER TABLE "collection_items" DROP CONSTRAINT IF EXISTS "collection_items_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "collection_items" DROP COLUMN "user_id";
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_collection_variant_condition_lang_idx" ON "collection_items" USING btree ("collection_id","variant_number","condition","language");
--> statement-breakpoint
CREATE INDEX "collection_items_collection_id_idx" ON "collection_items" USING btree ("collection_id");
--> statement-breakpoint
-- When the last member of a collection is removed (e.g. user delete), drop the empty collection.
CREATE OR REPLACE FUNCTION cleanup_empty_collection()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM collection_members WHERE collection_id = OLD.collection_id
  ) THEN
    DELETE FROM collections WHERE id = OLD.collection_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS collection_members_cleanup_empty ON collection_members;
--> statement-breakpoint
CREATE TRIGGER collection_members_cleanup_empty
AFTER DELETE ON collection_members
FOR EACH ROW
EXECUTE PROCEDURE cleanup_empty_collection();
