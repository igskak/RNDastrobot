-- Migration 039: Drop legacy saved_charts table
-- The "saved chart link" bookmark model is removed in favour of the unified
-- charts (users) model. Prognostic results (solar_returns, progressions,
-- directions) are unaffected — they keep their own tables and endpoints.

DROP INDEX IF EXISTS idx_saved_charts_user_created;
DROP INDEX IF EXISTS idx_saved_charts_user_type;
DROP TABLE IF EXISTS saved_charts;
