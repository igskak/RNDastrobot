-- 028: account preferences, chart view overrides, and persisted house system

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS default_house_system VARCHAR(1) NOT NULL DEFAULT 'P';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS house_system VARCHAR(1) NOT NULL DEFAULT 'P';

UPDATE astrologers
SET default_house_system = COALESCE(default_house_system, 'P')
WHERE default_house_system IS NULL;

UPDATE users
SET house_system = COALESCE(house_system, 'P')
WHERE house_system IS NULL;

CREATE TABLE IF NOT EXISTS astrologer_preferences (
    astrologer_id UUID PRIMARY KEY REFERENCES astrologers(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    chart_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
    methodology JSONB NOT NULL DEFAULT '{}'::jsonb,
    visual JSONB NOT NULL DEFAULT '{}'::jsonb,
    chart_creation_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_view_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chart_kind TEXT NOT NULL CHECK (chart_kind IN ('natal', 'solar')),
    chart_id UUID NOT NULL,
    view_type TEXT NOT NULL CHECK (view_type IN ('natal', 'biwheel', 'solar')),
    overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chart_view_overrides_chart_view
    ON chart_view_overrides(chart_kind, chart_id, view_type);

CREATE INDEX IF NOT EXISTS idx_chart_view_overrides_chart
    ON chart_view_overrides(chart_kind, chart_id);

CREATE INDEX IF NOT EXISTS idx_chart_view_overrides_updated_at
    ON chart_view_overrides(updated_at);
