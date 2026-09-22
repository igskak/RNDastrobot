"""Unit tests for the Stripe billing portal and cross-mode webhook guard.

Regression context: a test-mode ``customer.subscription`` webhook reached the
live deployment, was signature-verified with the same endpoint secret and was
stored as a real subscription. The account then showed an active plan whose
Stripe customer id only exists in test mode, so ``GET /billing/portal`` failed
with Stripe's ``resource_missing`` and the user had no way to cancel.

Covered here:
1. The happy path still opens a portal for the stored customer.
2. A stored customer the current key cannot see is re-resolved by email, the
   row is repaired, and the portal opens.
3. When nothing can be resolved the caller gets an actionable 409, not a 502
   carrying Stripe's raw error body.
4. A provider failure that is *not* a missing customer is surfaced as-is and
   never triggers the re-resolve path.
5. Events from the other Stripe mode are refused before they touch billing.

The network is stubbed via ``_api_request``; the DB is a minimal stub because
these paths only read one row and write it back.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./_stripe_portal_test.db")
os.environ.setdefault("BILLING_PROVIDER", "stripe")

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402

from app.services.billing_service import (  # noqa: E402
    BillingProviderError,
    StripeBillingProvider,
)


class _Astro:
    id = "00000000-0000-0000-0000-000000000001"
    email = "astrologer@example.com"


class _CustomerRow:
    def __init__(self, customer_id):
        self.provider_customer_id = customer_id
        self.email = None


class _Query:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _DB:
    """Just enough Session for a single-row read plus a write-back."""

    def __init__(self, customer_row=None):
        self.customer_row = customer_row
        self.added = []
        self.flushes = 0

    def query(self, *args, **kwargs):
        return _Query(self.customer_row)

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        self.flushes += 1


def _provider(monkeypatch, handler, *, key="sk_live_dummy") -> StripeBillingProvider:
    os.environ["STRIPE_SECRET_KEY"] = key
    provider = StripeBillingProvider()
    monkeypatch.setattr(provider, "_api_request", handler)
    return provider


def _missing_customer_error() -> BillingProviderError:
    return BillingProviderError(
        "stripe",
        status_code=400,
        code="resource_missing",
        param="customer",
        message="No such customer: 'cus_test'; a similar object exists in test mode.",
        raw='{"error": {"code": "resource_missing"}}',
    )


def test_portal_opens_for_stored_customer(monkeypatch):
    calls = []

    def handler(method, path, payload=None):
        calls.append((method, path, payload))
        assert path == "/v1/billing_portal/sessions"
        return {"url": "https://billing.stripe.com/p/session_ok"}

    provider = _provider(monkeypatch, handler)
    db = _DB(_CustomerRow("cus_live"))

    portal = provider.create_customer_portal(db, astrologer=_Astro())

    assert portal.portal_url.endswith("session_ok")
    assert calls[0][2]["customer"] == "cus_live"
    # Nothing to repair on the happy path.
    assert db.flushes == 0


def test_portal_reresolves_customer_unknown_to_current_key(monkeypatch):
    calls = []

    def handler(method, path, payload=None):
        calls.append((method, path, payload))
        if path.startswith("/v1/subscriptions/search?"):
            return {"data": []}
        if path.startswith("/v1/customers?"):
            return {"data": [{"id": "cus_live_real", "metadata": {"astrologer_id": _Astro.id}}]}
        if path == "/v1/billing_portal/sessions":
            if payload["customer"] == "cus_stale":
                raise _missing_customer_error()
            return {"url": "https://billing.stripe.com/p/session_recovered"}
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)
    row = _CustomerRow("cus_stale")
    db = _DB(row)

    portal = provider.create_customer_portal(db, astrologer=_Astro())

    assert portal.portal_url.endswith("session_recovered")
    # The stale id is repaired in place so the next click does not pay the
    # extra lookup.
    assert row.provider_customer_id == "cus_live_real"
    assert row.email == _Astro.email
    assert db.flushes == 1


def test_portal_email_lookup_ignores_ambiguous_matches(monkeypatch):
    def handler(method, path, payload=None):
        if path.startswith("/v1/subscriptions/search?"):
            return {"data": []}
        if path.startswith("/v1/customers?"):
            # Two customers share the email and neither names the astrologer:
            # guessing here would hand someone else's billing account over.
            return {"data": [{"id": "cus_a"}, {"id": "cus_b"}]}
        if path == "/v1/billing_portal/sessions":
            raise _missing_customer_error()
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)
    db = _DB(_CustomerRow("cus_stale"))

    with pytest.raises(HTTPException) as exc_info:
        provider.create_customer_portal(db, astrologer=_Astro())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["error_code"] == "BILLING_ACCOUNT_UNLINKED"


def test_portal_without_any_customer_returns_actionable_conflict(monkeypatch):
    def handler(method, path, payload=None):
        if path.startswith("/v1/subscriptions/search?"):
            return {"data": []}
        if path.startswith("/v1/customers?"):
            return {"data": []}
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)
    db = _DB(None)

    with pytest.raises(HTTPException) as exc_info:
        provider.create_customer_portal(db, astrologer=_Astro())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["error_code"] == "BILLING_ACCOUNT_UNLINKED"


def test_portal_surfaces_other_provider_errors_without_reresolving(monkeypatch):
    calls = []

    def handler(method, path, payload=None):
        calls.append(path)
        if path == "/v1/billing_portal/sessions":
            raise BillingProviderError(
                "stripe",
                status_code=400,
                code="billing_portal_configuration_invalid",
                message="No configuration provided",
                raw='{"error": {"code": "billing_portal_configuration_invalid"}}',
            )
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)

    with pytest.raises(HTTPException) as exc_info:
        provider.create_customer_portal(_DB(_CustomerRow("cus_live")), astrologer=_Astro())

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail["error_code"] == "BILLING_PROVIDER_ERROR"
    # The provider's prose names customer ids, the account and a dashboard log
    # URL — it belongs in the log, not in the response.
    assert "No configuration provided" not in str(exc_info.value.detail)
    assert not any(path.startswith("/v1/customers?") for path in calls)


@pytest.mark.parametrize(
    "key,event_livemode,expected",
    [
        ("sk_live_dummy", False, "livemode_mismatch"),
        ("sk_test_dummy", True, "livemode_mismatch"),
        ("sk_live_dummy", True, None),
        ("sk_test_dummy", False, None),
        # Undetectable key shape or an event without the flag: process as before.
        ("restricted_key", False, None),
        ("sk_live_dummy", None, None),
    ],
)
def test_should_ignore_event_guards_stripe_mode(monkeypatch, key, event_livemode, expected):
    os.environ["STRIPE_SECRET_KEY"] = key
    provider = StripeBillingProvider()
    payload = {"id": "evt_1", "type": "customer.subscription.updated"}
    if event_livemode is not None:
        payload["livemode"] = event_livemode

    assert provider.should_ignore_event(payload) == expected


def test_webhook_route_drops_cross_mode_event_before_persisting(monkeypatch):
    """The guard must sit in front of the writer, not inside it."""
    import asyncio

    import app.api.routes.billing as billing_route

    os.environ["STRIPE_SECRET_KEY"] = "sk_live_dummy"
    provider = StripeBillingProvider()
    monkeypatch.setattr(provider, "verify_webhook", lambda raw, headers: {"id": "evt_test", "livemode": False})
    monkeypatch.setattr(billing_route, "get_billing_provider", lambda: provider)

    def _must_not_run(*args, **kwargs):
        raise AssertionError("a test-mode event must never reach billing state")

    monkeypatch.setattr(billing_route, "process_billing_webhook", _must_not_run)

    class _Request:
        headers: dict = {}

        async def body(self):
            return b"{}"

    result = asyncio.run(billing_route._handle_billing_webhook(_Request(), _DB(), "stripe"))

    # 200 with a body, so Stripe stops retrying an event we will never accept.
    assert result == {"status": "ignored", "reason": "livemode_mismatch"}


def test_portal_opens_even_if_caching_the_repaired_id_fails(monkeypatch):
    """The unique index on (provider, customer) must not cost a user the portal."""
    from sqlalchemy.exc import IntegrityError

    def handler(method, path, payload=None):
        if path.startswith("/v1/subscriptions/search?"):
            return {"data": []}
        if path.startswith("/v1/customers?"):
            return {"data": [{"id": "cus_live_real", "metadata": {"astrologer_id": _Astro.id}}]}
        if path == "/v1/billing_portal/sessions":
            if payload["customer"] == "cus_stale":
                raise _missing_customer_error()
            return {"url": "https://billing.stripe.com/p/session_recovered"}
        raise AssertionError(f"unexpected call {method} {path}")

    class _ClashingDB(_DB):
        def __init__(self, row):
            super().__init__(row)
            self.rollbacks = 0

        def flush(self):
            raise IntegrityError("duplicate", None, Exception("duplicate"))

        def rollback(self):
            self.rollbacks += 1

    provider = _provider(monkeypatch, handler)
    db = _ClashingDB(_CustomerRow("cus_stale"))

    portal = provider.create_customer_portal(db, astrologer=_Astro())

    assert portal.portal_url.endswith("session_recovered")
    assert db.rollbacks == 1


def test_portal_recovers_via_subscription_metadata_when_email_is_ambiguous(monkeypatch):
    """The real shape of the incident: the card is charged live, our row is not.

    Checkout stamps astrologer_id onto the subscription, never onto the
    customer, so several customers can share the email and the email route
    alone would give up. The subscription search resolves it exactly.
    """
    calls = []

    def handler(method, path, payload=None):
        calls.append(path)
        if path.startswith("/v1/subscriptions/search?"):
            return {
                "data": [
                    {"id": "sub_cancelled", "status": "canceled", "customer": "cus_old"},
                    {"id": "sub_live", "status": "active", "customer": "cus_live_real"},
                ]
            }
        if path.startswith("/v1/customers?"):
            raise AssertionError("must not fall back to email once the search resolved")
        if path == "/v1/billing_portal/sessions":
            if payload["customer"] == "cus_testmode":
                raise _missing_customer_error()
            return {"url": "https://billing.stripe.com/p/session_live"}
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)
    row = _CustomerRow("cus_testmode")

    portal = provider.create_customer_portal(_DB(row), astrologer=_Astro())

    assert portal.portal_url.endswith("session_live")
    # The paying subscription wins over a cancelled one.
    assert row.provider_customer_id == "cus_live_real"
    search = next(path for path in calls if path.startswith("/v1/subscriptions/search?"))
    assert "astrologer_id" in search


def test_subscription_lookup_refuses_a_non_uuid_astrologer_id(monkeypatch):
    """Never interpolate an unvalidated value into a Stripe search query."""

    class _OddAstro:
        id = "x' OR metadata['astrologer_id']:'y"
        email = "astrologer@example.com"

    def handler(method, path, payload=None):
        if path.startswith("/v1/subscriptions/search?"):
            raise AssertionError("must not search with an unvalidated id")
        if path.startswith("/v1/customers?"):
            return {"data": []}
        raise AssertionError(f"unexpected call {method} {path}")

    provider = _provider(monkeypatch, handler)

    with pytest.raises(HTTPException) as exc_info:
        provider.create_customer_portal(_DB(None), astrologer=_OddAstro())

    assert exc_info.value.status_code == 409
