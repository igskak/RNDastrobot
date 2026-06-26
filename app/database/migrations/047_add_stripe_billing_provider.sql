-- Migration 047: Allow 'stripe' (Stripe Managed Payments) as a billing provider.
-- Extends the provider CHECK constraints introduced in 042 to accept 'stripe'
-- alongside 'paddle'. Schema is otherwise provider-agnostic.

ALTER TABLE billing_customers DROP CONSTRAINT IF EXISTS chk_billing_customers_provider;
ALTER TABLE billing_customers
    ADD CONSTRAINT chk_billing_customers_provider CHECK (provider IN ('paddle', 'stripe'));

ALTER TABLE billing_subscriptions DROP CONSTRAINT IF EXISTS chk_billing_subscriptions_provider;
ALTER TABLE billing_subscriptions
    ADD CONSTRAINT chk_billing_subscriptions_provider CHECK (provider IN ('paddle', 'stripe'));

ALTER TABLE billing_events DROP CONSTRAINT IF EXISTS chk_billing_events_provider;
ALTER TABLE billing_events
    ADD CONSTRAINT chk_billing_events_provider CHECK (provider IN ('paddle', 'stripe'));

ALTER TABLE billing_price_map DROP CONSTRAINT IF EXISTS chk_billing_price_map_provider;
ALTER TABLE billing_price_map
    ADD CONSTRAINT chk_billing_price_map_provider CHECK (provider IN ('paddle', 'stripe'));
