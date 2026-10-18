CREATE TABLE "card_colors" (
	"card_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	CONSTRAINT "card_colors_card_id_color_id_pk" PRIMARY KEY("card_id","color_id")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"super" text,
	"description" text NOT NULL,
	"energy" smallint NOT NULL,
	"might" smallint NOT NULL,
	"power" smallint NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attach_text" text,
	"effect" text,
	"might_bonus" smallint DEFAULT 0,
	"max_copies" smallint,
	"ban_effective_date" timestamp with time zone,
	"content_hash" char(64) NOT NULL,
	"upstream_raw" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hex_code" text,
	"image_url" text,
	CONSTRAINT "colors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "filter_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "filter_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"snapshot" jsonb NOT NULL,
	"content_hash" char(64) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY NOT NULL,
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
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"release_date" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"content_hash" char(64) NOT NULL,
	"row_count" integer DEFAULT 0,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"status" text DEFAULT 'idle' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"variant_number" text NOT NULL,
	"rarity" text NOT NULL,
	"variant_type" text NOT NULL,
	"foil_mode" text NOT NULL,
	"variant_types" jsonb NOT NULL,
	"image_url" text NOT NULL,
	"flavor_text" text,
	"artist" text,
	"release_date" text,
	"variant_label" text NOT NULL,
	"show_in_library" boolean NOT NULL,
	"is_collectible" boolean NOT NULL,
	"cardmarket_id" integer,
	"tcgplayer_id" integer,
	"parent_variant_id" uuid,
	"set_id" uuid NOT NULL,
	"content_hash" char(64) NOT NULL,
	"upstream_raw" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_variant_number_unique" UNIQUE("variant_number")
);
--> statement-breakpoint
ALTER TABLE "card_colors" ADD CONSTRAINT "card_colors_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_colors" ADD CONSTRAINT "card_colors_color_id_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."colors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prices_cardmarket_foil_idx" ON "prices" USING btree ("cardmarket_id","is_foil");--> statement-breakpoint
CREATE INDEX "variants_cardmarket_id_idx" ON "variants" USING btree ("cardmarket_id");--> statement-breakpoint
CREATE INDEX "variants_card_id_idx" ON "variants" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "variants_set_id_idx" ON "variants" USING btree ("set_id");