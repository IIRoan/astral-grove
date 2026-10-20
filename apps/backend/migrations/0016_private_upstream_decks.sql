CREATE TABLE private_upstream_decks (
    upstream_id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO private_upstream_decks (upstream_id)
SELECT DISTINCT payload->>'upstreamId' FROM user_decks
WHERE jsonb_typeof(payload->'upstreamId') = 'string'
  AND payload->>'upstreamId' <> ''
  AND (payload->>'importedFromId') IS DISTINCT FROM (payload->>'upstreamId')
ON CONFLICT DO NOTHING;
