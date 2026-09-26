-- Consultation audio is kept for 180 days and then deleted from storage; the transcript
-- and the summaries made from it stay on the profile (see
-- app/services/recording_retention_service.py).
--
-- audio_deleted_at records when the audio went, so a profile can tell "never recorded"
-- apart from "recorded, audio expired", and so every deletion is auditable.
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMP;

-- The purge scans only rows that still hold audio.
CREATE INDEX IF NOT EXISTS idx_call_sessions_audio_retention
    ON call_sessions (recording_started_at)
    WHERE audio_storage_path IS NOT NULL;
