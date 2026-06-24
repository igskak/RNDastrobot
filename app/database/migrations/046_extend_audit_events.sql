-- 046: enrich audit_events for deep product/behaviour analytics.
--
-- Adds structured context (properties) and a session correlation key so audit
-- rows can be joined into session funnels and mirrored to PostHog with the same
-- distinct_id/session identity. Closes gaps G1 (properties) and G3 (session_id)
-- from GRANT_METRICS_PLAN.md. Idempotent — safe to re-run.
--
-- session_id intentionally has NO foreign key to auth_sessions: audit_events is
-- an append-only log that must survive session pruning.

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS properties JSONB;

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_audit_events_session
    ON audit_events(session_id, created_at DESC);
