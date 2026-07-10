-- 051: account-synced onboarding progress for the astrologer workspace.

ALTER TABLE astrologer_preferences
    ADD COLUMN IF NOT EXISTS onboarding JSONB NOT NULL DEFAULT '{}'::jsonb;

