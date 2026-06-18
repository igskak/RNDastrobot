-- 044: Consultation Summarizer v1
-- Brownfield integration into the existing call_sessions pipeline.
--  (a) immutable consultation_transcripts (source of truth, INSERT-once)
--  (b) two-actor client_memory_entries (pipeline INSERTs source='ai'; astrologer edits/soft-deletes)
--  (c) summary_json/schema/error columns on call_sessions
--  (d) new 'summary_failed' call_status so a summary failure never discards a good transcript

-- ── (0) Drop stale orphan tables from the deleted old codebase's migration 024.
-- They used a session_id/client_id shape never wired into the new pipeline and
-- are empty. Verified rows=0 before writing this migration.
DROP TABLE IF EXISTS consultation_summaries CASCADE;
DROP TABLE IF EXISTS consultation_transcripts CASCADE;
DROP TABLE IF EXISTS client_memory_entries CASCADE;

-- ── (a) Immutable transcript store ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultation_transcripts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_session_id UUID NOT NULL UNIQUE REFERENCES call_sessions(id) ON DELETE CASCADE,
    astrologer_id   UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    transcript_segments JSONB,
    language        VARCHAR(8),
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consultation_transcripts_tenant
    ON consultation_transcripts (astrologer_id, user_id, created_at);

-- ── (b) Append-by-pipeline, editable-by-astrologer client memory ────────────
CREATE TABLE IF NOT EXISTS client_memory_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_session_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL,
    astrologer_id   UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category        VARCHAR(32) NOT NULL,
    text            TEXT NOT NULL,
    mentioned_by    VARCHAR(16) NOT NULL,
    source          VARCHAR(16) NOT NULL DEFAULT 'ai',
    reviewed_at     TIMESTAMP,
    edited_at       TIMESTAMP,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT chk_cme_source CHECK (source IN ('ai','astrologer'))
);
-- Tenant-scoped history read (client profile card)
CREATE INDEX IF NOT EXISTS idx_cme_tenant
    ON client_memory_entries (astrologer_id, user_id, created_at)
    WHERE deleted_at IS NULL;
-- Idempotency defense: a given AI entry text can exist once per session while active.
-- Combined with delete-then-insert in the pipeline, reprocess never doubles history.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cme_ai_session_text
    ON client_memory_entries (call_session_id, md5(text))
    WHERE source = 'ai' AND deleted_at IS NULL;

-- ── (c) Summary contract columns on call_sessions ───────────────────────────
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS summary_json JSONB;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS summary_schema_version VARCHAR(8);
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS summary_error TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS client_report_edited TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS client_report_shared_at TIMESTAMP;

-- ── (d) New 'summary_failed' status (transcript saved, summary absent) ───────
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS chk_call_session_status;
ALTER TABLE call_sessions ADD CONSTRAINT chk_call_session_status
    CHECK (call_status IN ('created','active','ended','processing','completed','failed','summary_failed'));
