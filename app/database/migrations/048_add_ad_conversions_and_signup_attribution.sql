-- 048: ad attribution at signup + Google Ads offline-conversion (OCI) store.
--
-- Part D: persist the first-touch ad click id / attribution snapshot on the
-- astrologer so campaign context survives past the OAuth redirect and can be
-- joined for reporting.
--
-- Part E1: ad_conversions holds one row per registration that carried a Google
-- Ads click id (gclid/gbraid/wbraid). A background job (or CSV export) uploads
-- these to Google Ads via Offline Conversion Import. order_id is the dedup key
-- so one registration == one conversion, even if the uploader retries.
--
-- Idempotent — safe to re-run.

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS signup_gclid VARCHAR(512);

ALTER TABLE astrologers
    ADD COLUMN IF NOT EXISTS signup_attribution JSONB;

CREATE TABLE IF NOT EXISTS ad_conversions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astrologer_id    UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    gclid            VARCHAR(512),
    gbraid           VARCHAR(512),
    wbraid           VARCHAR(512),
    email            VARCHAR(255),
    order_id         VARCHAR(255) NOT NULL UNIQUE,
    conversion_time  TIMESTAMPTZ NOT NULL,
    conversion_value NUMERIC(12, 2),
    currency         VARCHAR(3) NOT NULL DEFAULT 'EUR',
    method           VARCHAR(16),
    uploaded         BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at      TIMESTAMPTZ,
    upload_error     TEXT,
    created_at       TIMESTAMP DEFAULT now()
);

-- Fast scan for the uploader (pending rows, oldest first).
CREATE INDEX IF NOT EXISTS idx_ad_conversions_pending
    ON ad_conversions(uploaded, created_at);

CREATE INDEX IF NOT EXISTS idx_ad_conversions_astrologer
    ON ad_conversions(astrologer_id);
