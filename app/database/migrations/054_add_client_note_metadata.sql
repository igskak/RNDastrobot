-- Migration 054: client memory metadata for manual/voice notes.

ALTER TABLE client_memory_entries
    ADD COLUMN IF NOT EXISTS origin VARCHAR(32) NOT NULL DEFAULT 'manual';

ALTER TABLE client_memory_entries
    ADD COLUMN IF NOT EXISTS context_snapshot JSONB;

ALTER TABLE client_memory_entries
    ADD COLUMN IF NOT EXISTS idempotency_key UUID;

UPDATE client_memory_entries
SET origin = CASE
    WHEN source = 'ai' THEN 'consultation_ai'
    ELSE 'manual'
END
WHERE origin IS NULL
   OR origin NOT IN ('manual', 'assistant_text', 'assistant_voice', 'consultation_ai');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_cme_origin'
    ) THEN
        ALTER TABLE client_memory_entries
            ADD CONSTRAINT chk_cme_origin
            CHECK (origin IN ('manual', 'assistant_text', 'assistant_voice', 'consultation_ai'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cme_source_origin_created
    ON client_memory_entries (astrologer_id, source, origin, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cme_astrologer_idempotency_key
    ON client_memory_entries (astrologer_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
