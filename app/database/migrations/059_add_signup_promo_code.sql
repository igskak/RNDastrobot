-- Migration 059: Campaign signup promo codes (extended free trial)
--
-- Records which promo code a new account signed up with (e.g. the conference
-- booklet QR code granting a 90-day trial instead of 14). Kept separate from
-- signup_attribution: this one is an entitlement input and the redemption
-- counter that caps how many times a printed code can be used.

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS signup_promo_code VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_astrologers_signup_promo_code
    ON astrologers(signup_promo_code)
    WHERE signup_promo_code IS NOT NULL;
