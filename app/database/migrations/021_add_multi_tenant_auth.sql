-- Migration 021: Multi-tenant authentication and audit foundation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS astrologers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NULL,
    auth_provider VARCHAR(16) NOT NULL DEFAULT 'local',
    google_sub VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_astrologers_auth_provider CHECK (auth_provider IN ('local', 'google'))
);

ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(16) NOT NULL DEFAULT 'local';
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE astrologers ALTER COLUMN password_hash DROP NOT NULL;
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'astrologers_email_key'
    ) THEN
        ALTER TABLE astrologers
            ADD CONSTRAINT astrologers_email_key UNIQUE (email);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_astrologers_google_sub
    ON astrologers (google_sub)
    WHERE google_sub IS NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS astrologer_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_astrologer_id'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_astrologer_id
            FOREIGN KEY (astrologer_id)
            REFERENCES astrologers(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_astrologer_id ON users(astrologer_id);

DO $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT id
    INTO v_owner_id
    FROM astrologers
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_owner_id IS NULL THEN
        INSERT INTO astrologers (email, auth_provider, is_active)
        VALUES ('legacy-owner@astrobot.local', 'local', TRUE)
        ON CONFLICT (email) DO NOTHING;

        SELECT id
        INTO v_owner_id
        FROM astrologers
        WHERE email = 'legacy-owner@astrobot.local'
        LIMIT 1;
    END IF;

    UPDATE users
    SET astrologer_id = v_owner_id
    WHERE astrologer_id IS NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE astrologer_id IS NULL) THEN
        RAISE NOTICE 'users.astrologer_id has NULL values, NOT NULL was not applied';
    ELSE
        ALTER TABLE users
            ALTER COLUMN astrologer_id SET NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    ip VARCHAR(64) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_astrologer ON auth_sessions(astrologer_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked ON auth_sessions(revoked_at);

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID NULL REFERENCES astrologers(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(255) NULL,
    result VARCHAR(32) NOT NULL,
    ip VARCHAR(64) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created_at ON audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_created_at ON audit_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_ip_created_at ON audit_events(ip, created_at DESC);
