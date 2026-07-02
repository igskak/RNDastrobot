-- Migration 049: chat-v2 beta capture on assistant_turn_metrics.
-- Adds the auditable payload behind each turn (guardrail outcome, deterministic
-- tool_results, frozen workspace manifest) and the per-turn correction signal the
-- beta astrologers use to feed rubric tuning + tuning export.
--
-- All columns are NULLABLE / DEFAULTed so this is backfill-safe: existing rows
-- keep working and pre-migration turns simply have NULL capture. Idempotent via
-- IF NOT EXISTS.

ALTER TABLE assistant_turn_metrics
    ADD COLUMN IF NOT EXISTS guardrail            TEXT,
    ADD COLUMN IF NOT EXISTS tool_results         JSONB,
    ADD COLUMN IF NOT EXISTS workspace_manifest   JSONB,
    ADD COLUMN IF NOT EXISTS correction_flag      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS correction_note      TEXT;

-- Export/tuning queries scan flagged turns per astrologer.
CREATE INDEX IF NOT EXISTS idx_assistant_metrics_correction
    ON assistant_turn_metrics (astrologer_id, correction_flag)
    WHERE correction_flag = TRUE;
