-- Migration 036: Account plan foundation for feature entitlements

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS plan_code VARCHAR(32) NOT NULL DEFAULT 'pro',
    ADD COLUMN IF NOT EXISTS plan_assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP NULL;

UPDATE astrologers
SET plan_code = COALESCE(NULLIF(plan_code, ''), 'pro'),
    plan_assigned_at = COALESCE(plan_assigned_at, CURRENT_TIMESTAMP)
WHERE plan_code IS NULL
   OR plan_code = ''
   OR plan_assigned_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_astrologers_plan_code'
    ) THEN
        ALTER TABLE astrologers
            ADD CONSTRAINT chk_astrologers_plan_code
            CHECK (plan_code IN ('trial', 'solo', 'standard', 'pro'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_astrologers_plan_code ON astrologers(plan_code);
