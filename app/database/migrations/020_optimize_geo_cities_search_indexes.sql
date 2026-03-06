-- Migration 020: Geo cities search performance indexes for autocomplete

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Prefix search on lower(name) and lower(ascii_name)
CREATE INDEX IF NOT EXISTS idx_geo_cities_name_lower_prefix
ON geo_cities ((LOWER(name)) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_geo_cities_ascii_name_lower_prefix
ON geo_cities ((LOWER(COALESCE(ascii_name, ''))) text_pattern_ops);

-- Contains search on alternate_names via trigram
CREATE INDEX IF NOT EXISTS idx_geo_cities_alternate_names_trgm
ON geo_cities
USING GIN (LOWER(COALESCE(alternate_names, '')) gin_trgm_ops);
