CREATE TABLE IF NOT EXISTS "collection_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collection_id" uuid,
  "actor_user_id" text NOT NULL,
  "action" text NOT NULL,
  "variant_number" text,
  "condition" text,
  "language" text,
  "is_foil" boolean,
  "quantity_before" integer,
  "quantity_after" integer,
  "quantity_delta" integer,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "collection_audit_events"
  ADD CONSTRAINT "collection_audit_events_collection_id_collections_id_fk"
  FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_audit_events"
  ADD CONSTRAINT "collection_audit_events_actor_user_id_user_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_audit_events_collection_created_idx"
  ON "collection_audit_events" ("collection_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_audit_events_actor_created_idx"
  ON "collection_audit_events" ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_audit_events_variant_created_idx"
  ON "collection_audit_events" ("variant_number","created_at");
