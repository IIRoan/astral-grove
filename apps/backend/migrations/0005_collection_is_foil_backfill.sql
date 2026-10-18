-- Recompute collection_items.is_foil from catalog variant metadata.
-- Prior logic treated any foil_mode other than lowercase 'none' as foil, which
-- marked every row true because upstream uses both/foil_only/nonfoil_only.
UPDATE collection_items AS c
SET is_foil = (
  v.foil_mode ILIKE 'foil_only'
  OR v.variant_number ILIKE '%foil%'
  OR v.variant_label ILIKE '%foil%'
  OR v.variant_type ILIKE '%foil%'
)
FROM variants AS v
WHERE c.variant_number = v.variant_number;
