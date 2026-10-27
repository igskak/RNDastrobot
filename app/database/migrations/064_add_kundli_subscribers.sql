-- Public kundli tools: paying visitors without an account.
--
-- Access to a report is a signed link (HMAC of the id), so nothing secret is stored here.
-- Birth data is personal data (India DPDP Act 2023, GDPR): the table keeps only what the
-- weekly forecast needs, and POST /api/v1/kundli/erase deletes a row on request.
CREATE TABLE IF NOT EXISTS kundli_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'en',
    display_name VARCHAR(40),
    birth_date DATE NOT NULL,
    birth_time TIME,
    timezone VARCHAR(64) NOT NULL,
    place_label VARCHAR(200),
    cadence VARCHAR(16) NOT NULL DEFAULT 'weekly',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    provider VARCHAR(32) NOT NULL DEFAULT 'stripe',
    provider_customer_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    consent_at TIMESTAMP NOT NULL,
    last_digest_sent_at TIMESTAMP,
    welcome_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_kundli_subscribers_cadence CHECK (cadence IN ('weekly', 'biweekly')),
    CONSTRAINT chk_kundli_subscribers_status CHECK (status IN ('pending', 'active', 'past_due', 'canceled')),
    CONSTRAINT uq_kundli_subscribers_subscription UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_kundli_subscribers_email ON kundli_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_kundli_subscribers_status ON kundli_subscribers (status);
