-- Migration 037: Chart-first metadata on the existing calculation entity.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS title VARCHAR(160);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS chart_kind VARCHAR(32) NOT NULL DEFAULT 'birth';

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS valid_chart_kind;

ALTER TABLE users
    ADD CONSTRAINT valid_chart_kind
    CHECK (chart_kind IN ('birth', 'event', 'company', 'horary', 'relocation', 'solar_point', 'test', 'other'));

CREATE INDEX IF NOT EXISTS idx_users_astrologer_chart_kind ON users(astrologer_id, chart_kind);

COMMENT ON COLUMN users.title IS 'Название карты в chart-first библиотеке';
COMMENT ON COLUMN users.chart_kind IS 'Тип карты-источника: birth, event, company, horary, relocation, solar_point, test, other';
