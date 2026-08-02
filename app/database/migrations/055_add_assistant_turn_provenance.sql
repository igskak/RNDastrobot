-- Migration 055: methodology provenance on assistant_turn_metrics.
-- A turn's numbers depend on the astrologer's methodology (orbs, dignities,
-- stationary threshold). The content hash already existed in preferences_runtime
-- but was captured only by the transit cache, so a past answer became
-- unreproducible as soon as settings changed. Capture it per turn.
--
-- Both columns are NULLABLE => backfill-safe: pre-migration turns keep working
-- and simply carry no provenance. Idempotent via IF NOT EXISTS.

ALTER TABLE assistant_turn_metrics
    ADD COLUMN IF NOT EXISTS methodology_hash   TEXT,
    ADD COLUMN IF NOT EXISTS resolved_settings  JSONB;

-- Reproducibility queries scan a given astrologer's turns by methodology
-- revision ("which answers predate the orb change?").
CREATE INDEX IF NOT EXISTS idx_assistant_metrics_methodology
    ON assistant_turn_metrics (astrologer_id, methodology_hash)
    WHERE methodology_hash IS NOT NULL;
