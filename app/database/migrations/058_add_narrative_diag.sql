-- Migration 058: why the narrative stage did not produce a report.
--
-- 057 recorded `narrated` as a boolean. That is enough to compute a rate and
-- not enough to act on one: false is returned when the stage is switched off,
-- when the turn was a lookup with nothing to narrate, when the model returned
-- an empty completion (the reasoning-budget failure), and when the call raised.
-- The last is a production outage and looked exactly like the first three.
--
-- Live cost of that ambiguity: a QA run on prod showed narrated=false and the
-- feature flag, the model entitlement and the deployed code version all had to
-- be eliminated by hand before the cause was known.
--
-- narrative_diag carries {status, model, effort, error?}, so the question is a
-- query. Status is one of: ok | disabled | not_analytical | empty | failed.
--
-- Nullable => backfill-safe. Idempotent.

ALTER TABLE assistant_turn_metrics
    ADD COLUMN IF NOT EXISTS narrative_diag JSONB;

-- "Which turns tried to narrate and failed?" is the alerting query, and the
-- rows it wants are a small minority, so a partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_assistant_metrics_narrative_failed
    ON assistant_turn_metrics (astrologer_id, created_at)
    WHERE narrative_diag->>'status' IN ('failed', 'empty');
