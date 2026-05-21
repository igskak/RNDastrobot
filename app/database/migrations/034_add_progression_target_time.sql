-- Migration: Add exact target moment fields for secondary progressions
-- Date: 2026-05-21

ALTER TABLE progressions
    ADD COLUMN IF NOT EXISTS target_time TIME,
    ADD COLUMN IF NOT EXISTS timezone TEXT,
    ADD COLUMN IF NOT EXISTS target_utc TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS target_moment_key TEXT NOT NULL DEFAULT 'date-only';

DROP INDEX IF EXISTS idx_progressions_user_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progressions_user_moment
    ON progressions(user_id, target_date, target_moment_key);

CREATE INDEX IF NOT EXISTS idx_progressions_target_utc
    ON progressions(target_utc);

COMMENT ON COLUMN progressions.target_time IS 'Локальное время прогностического момента';
COMMENT ON COLUMN progressions.timezone IS 'IANA timezone прогностического момента';
COMMENT ON COLUMN progressions.target_utc IS 'UTC datetime прогностического момента';
COMMENT ON COLUMN progressions.target_moment_key IS 'Ключ точного момента для уникальности; date-only для legacy расчётов';
