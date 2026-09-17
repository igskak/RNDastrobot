-- Migration 060: Explicit email marketing consent captured at registration.
--
-- Consent is optional and disabled by default. The timestamp records when an
-- affirmative opt-in was submitted; accounts created without one remain false.

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS marketing_email_consent_at TIMESTAMP;
