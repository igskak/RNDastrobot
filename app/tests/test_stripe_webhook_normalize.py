"""Unit tests for StripeBillingProvider.normalize_event parsing.

Covers two billing follow-ups:
1. invoice.payment_failed must resolve the related subscription and map to
   past_due, NOT be mis-parsed as a subscription object.
2. current_period_* must be read from the subscription item when absent at the
   top level (Stripe 2025-03-31.basil shape), so a future webhook API-version
   bump does not silently null the subscription period.

These paths never touch the DB (metadata carries plan_code, or plan_code stays
None), so a stub session is sufficient.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./_stripe_normalize_test.db")
os.environ.setdefault("BILLING_PROVIDER", "stripe")

from app.services.billing_service import StripeBillingProvider  # noqa: E402


_DB = object()  # normalize_event must not query it on these paths


def _provider() -> StripeBillingProvider:
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
    return StripeBillingProvider()


def test_invoice_payment_failed_maps_to_past_due_with_subscription():
    payload = {
        "id": "evt_1",
        "type": "invoice.payment_failed",
        "data": {
            "object": {
                "object": "invoice",
                "customer": "cus_123",
                "subscription": "sub_123",
            }
        },
    }
    event = _provider().normalize_event(_DB, payload)
    assert event.subscription_id == "sub_123"
    assert event.customer_id == "cus_123"
    assert event.status == "past_due"
    # Must not invent a plan from an invoice — plan stays owned by subscription.*
    assert event.plan_code is None


def test_invoice_payment_failed_resolves_basil_nested_subscription():
    payload = {
        "id": "evt_2",
        "type": "invoice.payment_failed",
        "data": {
            "object": {
                "object": "invoice",
                "customer": "cus_b",
                # 2025-03-31.basil nests the subscription id here.
                "parent": {"subscription_details": {"subscription": "sub_basil"}},
            }
        },
    }
    event = _provider().normalize_event(_DB, payload)
    assert event.subscription_id == "sub_basil"
    assert event.status == "past_due"


def test_subscription_period_falls_back_to_item_basil_shape():
    # Basil removed current_period_* from the subscription top level.
    payload = {
        "id": "evt_3",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "object": "subscription",
                "id": "sub_x",
                "customer": "cus_x",
                "status": "active",
                "metadata": {
                    "astrologer_id": "11111111-1111-1111-1111-111111111111",
                    "plan_code": "standard",
                    "interval": "monthly",
                },
                "items": {
                    "data": [
                        {
                            "current_period_start": 1785251000,
                            "current_period_end": 1785251225,
                            "price": {"id": "price_x", "recurring": {"interval": "month"}},
                        }
                    ]
                },
            }
        },
    }
    event = _provider().normalize_event(_DB, payload)
    assert event.status == "active"
    assert event.plan_code == "standard"
    assert event.current_period_start is not None
    assert event.current_period_end is not None


def test_subscription_period_prefers_top_level_when_present():
    # Pre-Basil (2020-03-02) shape: period at the top level.
    payload = {
        "id": "evt_4",
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "object": "subscription",
                "id": "sub_y",
                "customer": "cus_y",
                "status": "active",
                "current_period_start": 1785000000,
                "current_period_end": 1785999999,
                "metadata": {
                    "astrologer_id": "22222222-2222-2222-2222-222222222222",
                    "plan_code": "pro",
                },
                "items": {"data": [{"price": {"id": "price_y", "recurring": {"interval": "month"}}}]},
            }
        },
    }
    event = _provider().normalize_event(_DB, payload)
    assert event.plan_code == "pro"
    assert event.current_period_start is not None
    assert event.current_period_end is not None
