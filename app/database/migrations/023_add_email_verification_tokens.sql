-- Migration 023: Email verification for local auth

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(8),
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(16) NOT NULL DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE astrologers ALTER COLUMN auth_provider SET DEFAULT 'local';
ALTER TABLE astrologers ALTER COLUMN auth_provider SET NOT NULL;
ALTER TABLE astrologers ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE astrologers ALTER COLUMN is_active SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_astrologers_auth_provider'
    ) THEN
        ALTER TABLE astrologers
            ADD CONSTRAINT chk_astrologers_auth_provider
            CHECK (auth_provider IN ('local', 'google'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(64) NULL,
    user_agent TEXT NULL
);

ALTER TABLE email_verification_tokens
    ADD COLUMN IF NOT EXISTS astrologer_id UUID,
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ip VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS user_agent TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_email_verification_tokens_astrologer'
    ) THEN
        ALTER TABLE email_verification_tokens
            ADD CONSTRAINT fk_email_verification_tokens_astrologer
            FOREIGN KEY (astrologer_id)
            REFERENCES astrologers(id)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'email_verification_tokens_token_hash_key'
    ) THEN
        ALTER TABLE email_verification_tokens
            ADD CONSTRAINT email_verification_tokens_token_hash_key
            UNIQUE (token_hash);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_astrologer
    ON email_verification_tokens(astrologer_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires
    ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_used
    ON email_verification_tokens(used_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_active_lookup
    ON email_verification_tokens(token_hash, expires_at)
    WHERE used_at IS NULL;

UPDATE astrologers
SET email_verified_at = COALESCE(email_verified_at, created_at, CURRENT_TIMESTAMP)
WHERE auth_provider = 'google'
  AND email_verified_at IS NULL;

DELETE FROM email_verification_tokens
WHERE used_at IS NOT NULL
   OR expires_at < CURRENT_TIMESTAMP;
