-- Migration 057: per-turn quality signals (spec §26).
--
-- Everything built for the analyst rework was shipped without a way to tell
-- whether it is being used. There is no answer today to "does a broad question
-- actually reach the bulk tool", "how often is a number ungrounded", or "how
-- often does the guardrail fire on a valid reply" — the targets §26 sets.
--
-- unsupported_dates is the sharpest of these: the check already runs on every
-- turn and caught a real fabrication of 14 dates, and the result was thrown
-- away. Persisting it turns a one-off catch into a rate.
--
-- All columns NULLABLE => backfill-safe. Idempotent.

ALTER TABLE assistant_turn_metrics
    ADD COLUMN IF NOT EXISTS unsupported_dates  JSONB,
    ADD COLUMN IF NOT EXISTS tools_used         JSONB,
    ADD COLUMN IF NOT EXISTS narrated           BOOLEAN;

-- "Which turns produced an ungrounded number?" scans a small minority of rows,
-- so a partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_assistant_metrics_unsupported
    ON assistant_turn_metrics (astrologer_id, created_at)
    WHERE unsupported_dates IS NOT NULL
      AND jsonb_array_length(unsupported_dates) > 0;
