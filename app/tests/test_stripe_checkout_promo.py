"""Unit tests for StripeBillingProvider.create_checkout promo-code handling.

Checkout's ``discounts[].promotion_code`` requires the promotion code *id*
(``promo_...``), not the customer-facing code. These tests cover:
1. A typed code is resolved to its promotion code id before checkout creation.
2. No code → ``allow_promotion_codes`` is enabled so the customer can enter one
   on the Stripe Checkout page (and no resolve lookup happens).
3. An unknown/expired code is rejected with 400 and never creates a session.

The network is stubbed via ``_api_request``; ``get_price_id`` is patched so the
path never touches the DB.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./_stripe_checkout_promo_test.db")
os.environ.setdefault("BILLING_PROVIDER", "stripe")

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402

import app.services.billing_service as billing_service  # noqa: E402
from app.services.billing_service import StripeBillingProvider  # noqa: E402


class _Astro:
    id = "00000000-0000-0000-0000-000000000001"
    email = "astrologer@example.com"


def _provider(monkeypatch, handler) -> StripeBillingProvider:
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
    os.environ["STRIPE_SUCCESS_URL"] = "https://app.example.com/ok"
    os.environ["STRIPE_CANCEL_URL"] = "https://app.example.com/cancel"
    provider = StripeBillingProvider()
    monkeypatch.setattr(provider, "_api_request", handler)
    monkeypatch.setattr(billing_service, "get_price_id", lambda *a, **k: "price_123")
    return provider


def test_create_checkout_resolves_promotion_code(monkeypatch):
    calls = []

    def handler(method, path, payload=None):
        calls.append((method, path, payload))
        if path.startswith("/v1/promotion_codes"):
            return {"object": "list", "data": [{"id": "promo_resolved"}]}
        if path == "/v1/checkout/sessions":
            return {"url": "https://checkout.stripe.com/c/session_abc"}
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)
    result = provider.create_checkout(
        object(), astrologer=_Astro(), plan_code="pro", interval="monthly", coupon_code="FREEBETA"
    )

    assert result.checkout_url.endswith("session_abc")
    promo_lookups = [c for c in calls if c[1].startswith("/v1/promotion_codes")]
    assert promo_lookups and "code=FREEBETA" in promo_lookups[0][1]
    checkout = next(c for c in calls if c[1] == "/v1/checkout/sessions")
    assert checkout[2]["discounts"] == [{"promotion_code": "promo_resolved"}]
    assert "allow_promotion_codes" not in checkout[2]
    # Comped users must not be asked for a card when nothing is due now.
    assert checkout[2]["payment_method_collection"] == "if_required"


def test_create_checkout_without_code_allows_promo_entry(monkeypatch):
    calls = []

    def handler(method, path, payload=None):
        calls.append((method, path, payload))
        if path == "/v1/checkout/sessions":
            return {"url": "https://checkout.stripe.com/c/session_xyz"}
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)
    provider.create_checkout(
        object(), astrologer=_Astro(), plan_code="pro", interval="monthly", coupon_code=None
    )

    checkout = next(c for c in calls if c[1] == "/v1/checkout/sessions")
    assert checkout[2]["allow_promotion_codes"] is True
    assert "discounts" not in checkout[2]
    assert not any(c[1].startswith("/v1/promotion_codes") for c in calls)


def test_create_checkout_rejects_unknown_code(monkeypatch):
    def handler(method, path, payload=None):
        if path.startswith("/v1/promotion_codes"):
            return {"object": "list", "data": []}
        raise AssertionError("checkout must not be created for an invalid code")

    provider = _provider(monkeypatch, handler)
    with pytest.raises(HTTPException) as exc_info:
        provider.create_checkout(
            object(), astrologer=_Astro(), plan_code="pro", interval="monthly", coupon_code="BADCODE"
        )
    assert exc_info.value.status_code == 400


def test_resolve_promotion_code_passes_through_id(monkeypatch):
    def handler(method, path, payload=None):
        raise AssertionError("promo_ ids must not trigger a lookup")

    provider = _provider(monkeypatch, handler)
    assert provider._resolve_promotion_code_id("promo_existing") == "promo_existing"
