-- Migration: 029_add_preference_recalc_jobs_and_methodology_hash.sql
-- Add DB-backed preference recalculation jobs and transit cache methodology versioning

CREATE TABLE IF NOT EXISTS preference_recalc_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    job_type VARCHAR(64) NOT NULL DEFAULT 'methodology_recalc',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    progress_total INTEGER NOT NULL DEFAULT 0,
    progress_done INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    CONSTRAINT valid_preference_recalc_job_type CHECK (job_type IN ('methodology_recalc')),
    CONSTRAINT valid_preference_recalc_job_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_preference_recalc_jobs_astrologer_created
    ON preference_recalc_jobs(astrologer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_preference_recalc_jobs_status_created
    ON preference_recalc_jobs(status, created_at);

ALTER TABLE transit_events_cache
    ADD COLUMN IF NOT EXISTS methodology_hash VARCHAR(64) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tec_user_period_methodology
    ON transit_events_cache(user_id, start_date, end_date, methodology_hash);
