INSERT INTO private_upstream_decks (upstream_id)
SELECT DISTINCT id FROM user_decks
WHERE id NOT LIKE 'deck\_%'
  AND (payload->>'importedFromId') IS DISTINCT FROM id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO private_upstream_decks (upstream_id)
SELECT DISTINCT payload->>'upstreamId' FROM user_deck_versions
WHERE jsonb_typeof(payload->'upstreamId') = 'string'
  AND payload->>'upstreamId' <> ''
  AND (payload->>'importedFromId') IS DISTINCT FROM (payload->>'upstreamId')
ON CONFLICT DO NOTHING;
