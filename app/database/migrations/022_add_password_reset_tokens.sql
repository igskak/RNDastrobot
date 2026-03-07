-- Migration 022: Password reset tokens

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(64) NULL,
    user_agent TEXT NULL
);

ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS astrologer_id UUID;
ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);
ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMP NULL;
ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS ip VARCHAR(64) NULL;
ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS user_agent TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_password_reset_tokens_astrologer'
    ) THEN
        ALTER TABLE password_reset_tokens
            ADD CONSTRAINT fk_password_reset_tokens_astrologer
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
        WHERE conname = 'password_reset_tokens_token_hash_key'
    ) THEN
        ALTER TABLE password_reset_tokens
            ADD CONSTRAINT password_reset_tokens_token_hash_key
            UNIQUE (token_hash);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_astrologer
    ON password_reset_tokens(astrologer_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
    ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used
    ON password_reset_tokens(used_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active_lookup
    ON password_reset_tokens(token_hash, expires_at)
    WHERE used_at IS NULL;

DELETE FROM password_reset_tokens
WHERE used_at IS NOT NULL
   OR expires_at < CURRENT_TIMESTAMP;
