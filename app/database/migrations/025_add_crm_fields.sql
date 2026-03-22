-- Migration 025: CRM foundation — contact fields on users + consultations table
-- Adds contact details to existing users table and creates consultation tracking.

-- ─── Contact fields on users ────────────────────────────────────────────────
-- Use explicit public schema to avoid conflicts with Supabase auth.users table.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS messenger VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── Consultations table ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS consultations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    astrologer_id   UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    consultation_type VARCHAR(30) NOT NULL DEFAULT 'natal',
    scheduled_at    TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    status          VARCHAR(20) NOT NULL DEFAULT 'planned',
    is_paid         BOOLEAN NOT NULL DEFAULT FALSE,
    duration_minutes INTEGER,
    notes           TEXT,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
    forecast_run_id UUID REFERENCES forecast_runs(run_id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_consultation_type CHECK (consultation_type IN (
        'natal', 'transit', 'solar_return', 'progression', 'direction',
        'synastry', 'horary', 'other'
    )),
    CONSTRAINT chk_consultation_status CHECK (status IN (
        'planned', 'completed', 'cancelled', 'no_show'
    ))
);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id
    ON consultations(user_id);

CREATE INDEX IF NOT EXISTS idx_consultations_astrologer_id
    ON consultations(astrologer_id);

CREATE INDEX IF NOT EXISTS idx_consultations_scheduled
    ON consultations(astrologer_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultations_status
    ON consultations(astrologer_id, status);
