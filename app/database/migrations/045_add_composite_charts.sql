-- 045: persisted composite relationship charts.
-- Composite charts are calculated artifacts, not birth/event source charts, so
-- they live outside users while still preserving source references when present.

CREATE TABLE IF NOT EXISTS composite_charts (
    composite_chart_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    title VARCHAR(160),
    primary_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    partner_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    partner_birth_data JSONB,
    method VARCHAR(16) NOT NULL,
    house_system VARCHAR(1) NOT NULL DEFAULT 'P',
    chart_data JSONB NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_composite_method CHECK (method IN ('midpoint', 'davison'))
);

CREATE INDEX IF NOT EXISTS idx_composite_charts_astrologer_created
    ON composite_charts(astrologer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_composite_charts_primary
    ON composite_charts(astrologer_id, primary_user_id);

CREATE INDEX IF NOT EXISTS idx_composite_charts_partner
    ON composite_charts(astrologer_id, partner_user_id);
