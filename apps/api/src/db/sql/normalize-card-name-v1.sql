-- Versioned name normalizer for stored generated columns.
-- unaccent is not inherently immutable. This wrapper is IMMUTABLE only under the
-- operational promise that public.unaccent's dictionary/rules stay fixed.
-- Do not alter unaccent's built-in volatility. A rules change requires a new
-- function version and recomputing stored columns, not CREATE OR REPLACE.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE FUNCTION public.normalize_card_name_v1(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both ' ' FROM regexp_replace(
    regexp_replace(
      lower(
        public.unaccent(
          'public.unaccent'::regdictionary,
          coalesce(input, '')
        )
      ),
      '[^a-z0-9[:space:]]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

COMMENT ON FUNCTION public.normalize_card_name_v1(text) IS
  'Search name normalizer v1. Immutable only while public.unaccent dictionary/rules remain unchanged. Bump the function name to recompute stored values.';
