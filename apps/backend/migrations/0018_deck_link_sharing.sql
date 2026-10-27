ALTER TABLE "user_decks" ADD COLUMN "share_token" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_decks_share_token_unique" ON "user_decks" ("share_token") WHERE "share_token" IS NOT NULL;
