-- Migration 042: Provider-agnostic billing foundation with Paddle as first provider

CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    provider_customer_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    raw_provider_payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_billing_customers_provider CHECK (provider IN ('paddle'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_customers_provider_customer
    ON billing_customers(provider, provider_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_astrologer
    ON billing_customers(astrologer_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    billing_customer_id UUID REFERENCES billing_customers(id) ON DELETE SET NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subscription_id VARCHAR(255) NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    interval VARCHAR(16),
    status VARCHAR(32) NOT NULL,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    access_until TIMESTAMP,
    coupon_code VARCHAR(100),
    raw_provider_payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_billing_subscriptions_provider CHECK (provider IN ('paddle')),
    CONSTRAINT chk_billing_subscriptions_plan_code CHECK (plan_code IN ('standard', 'pro'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscriptions_provider_subscription
    ON billing_subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_astrologer
    ON billing_subscriptions(astrologer_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
    ON billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'received',
    raw_payload JSONB,
    error_message TEXT,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    CONSTRAINT chk_billing_events_provider CHECK (provider IN ('paddle'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_events_provider_event
    ON billing_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_provider_type
    ON billing_events(provider, event_type);

CREATE TABLE IF NOT EXISTS billing_price_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    interval VARCHAR(16) NOT NULL,
    provider_price_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_billing_price_map_provider CHECK (provider IN ('paddle')),
    CONSTRAINT chk_billing_price_map_plan_code CHECK (plan_code IN ('standard', 'pro')),
    CONSTRAINT chk_billing_price_map_interval CHECK (interval IN ('monthly', 'yearly'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_price_map_provider_plan_interval
    ON billing_price_map(provider, plan_code, interval);
CREATE INDEX IF NOT EXISTS idx_billing_price_map_lookup
    ON billing_price_map(provider, plan_code, interval, is_active);
