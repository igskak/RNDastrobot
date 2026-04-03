-- Migration: add_call_sessions
-- Creates the call_sessions table for video consultation calls (LiveKit)
-- Run this against your Supabase / PostgreSQL database.

CREATE TABLE IF NOT EXISTS call_sessions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astrologer_id               UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    consultation_id             UUID REFERENCES consultations(id) ON DELETE SET NULL,

    -- LiveKit
    livekit_room_name           VARCHAR(255) NOT NULL UNIQUE,
    livekit_egress_id           VARCHAR(255),

    -- Lifecycle
    call_status                 VARCHAR(20) NOT NULL DEFAULT 'created',
    started_at                  TIMESTAMP,
    ended_at                    TIMESTAMP,
    duration_seconds            INTEGER,

    -- Recording consent (both required before recording starts)
    astrologer_consent_at       TIMESTAMP,
    client_consent_at           TIMESTAMP,
    recording_started_at        TIMESTAMP,

    -- Client join token (unauthenticated access, stored as SHA-256 hash)
    client_join_token_hash      VARCHAR(128) UNIQUE,
    client_join_token_expires_at TIMESTAMP,

    -- Audio recording
    audio_storage_path          TEXT,
    audio_duration_seconds      INTEGER,

    -- Transcription (AssemblyAI)
    assemblyai_transcript_id    VARCHAR(255),
    transcript_text             TEXT,
    transcript_segments         JSONB,

    -- AI summary (OpenAI)
    summary_text                TEXT,
    key_points                  JSONB,
    client_facing_summary       TEXT,
    ai_model_used               VARCHAR(50),

    -- Error tracking
    processing_error            TEXT,

    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_call_session_status
        CHECK (call_status IN ('created','active','ended','processing','completed','failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_sessions_astrologer     ON call_sessions (astrologer_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_user           ON call_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_astrologer_user ON call_sessions (astrologer_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status         ON call_sessions (call_status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_token          ON call_sessions (client_join_token_hash);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_call_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_sessions_updated_at ON call_sessions;
CREATE TRIGGER trg_call_sessions_updated_at
    BEFORE UPDATE ON call_sessions
    FOR EACH ROW EXECUTE FUNCTION update_call_sessions_updated_at();
