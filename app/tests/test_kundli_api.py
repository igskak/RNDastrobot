"""Public kundli endpoints, guest checkout, webhooks, signed links and digests."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_kundli_api_test.db")

from app.api.main import app  # noqa: E402
from app.api.rate_limit import SlidingWindowLimiter, rate_limited  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import KundliSubscriber  # noqa: E402
from app.services import kundli_billing_service as billing  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, make_get_db_override, reset_sqlite_schema  # noqa: E402

BIRTH = {"date": "1990-05-17", "time": "14:30", "timezone": "Asia/Kolkata", "name": "Asha"}
SECRET = "unit-test-secret-0123456789abcdef"


@pytest.fixture
def db_factory(tmp_path):
    engine, factory = create_sqlite_test_session_factory(str(tmp_path / "kundli.db"))
    reset_sqlite_schema(engine)
    app.dependency_overrides[get_db] = make_get_db_override(factory)
    yield factory
    app.dependency_overrides.pop(get_db, None)
    engine.dispose()


@pytest.fixture
def client(db_factory):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def paid_env(monkeypatch):
    monkeypatch.setenv("KUNDLI_PAID_ENABLED", "1")
    monkeypatch.setenv("KUNDLI_LINK_SECRET", SECRET)
    monkeypatch.setenv("KUNDLI_STRIPE_PRICE_WEEKLY", "price_weekly")
    monkeypatch.setenv("KUNDLI_STRIPE_PRICE_BIWEEKLY", "price_biweekly")
    monkeypatch.setenv("KUNDLI_REVIEWED_LOCALES", "en,hi")
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://example.test")


@pytest.fixture
def stripe_calls(monkeypatch):
    calls = []

    def fake(self, method, path, payload=None):
        calls.append((method, path, payload))
        if path == "/v1/checkout/sessions":
            return {"url": "https://checkout.example/session"}
        if path == "/v1/billing_portal/sessions":
            return {"url": "https://portal.example/session"}
        return {}

    monkeypatch.setattr("app.services.billing_service.StripeBillingProvider._api_request", fake)
    return calls


@pytest.fixture
def sent_emails(monkeypatch):
    sent = []
    monkeypatch.setattr(
        "app.auth.mailer.send_transactional_email",
        lambda *, recipient, subject, body_text: sent.append((recipient, subject, body_text)) or True,
    )
    return sent


def _checkout_body(**overrides):
    body = {"birth": BIRTH, "email": "Asha@Example.com", "cadence": "weekly", "locale": "en", "consent": True}
    body.update(overrides)
    return body


def _make_active(db_factory, **kwargs):
    with db_factory() as db:
        sub = KundliSubscriber(
            id=uuid.uuid4(), email="a@example.com", locale=kwargs.pop("locale", "en"), display_name="Asha",
            birth_date=datetime(1990, 5, 17).date(), birth_time=datetime(1990, 5, 17, 14, 30).time(),
            timezone="Asia/Kolkata", cadence=kwargs.pop("cadence", "weekly"), status=kwargs.pop("status", "active"),
            provider="stripe", consent_at=datetime.utcnow(), **kwargs,
        )
        db.add(sub)
        db.commit()
        return sub.id


# --- free calculators --------------------------------------------------------------------

def test_dasha_endpoint_returns_a_free_report(client):
    response = client.post("/api/v1/kundli/dasha", json={"birth": BIRTH, "locale": "en"})
    assert response.status_code == 200, response.text
    body = response.json()
    report = body["report"]
    assert report["kind"] == "dasha" and report["sections"] == []
    assert report["data"]["moon"]["nakshatra_label"] == "Dhanishta"
    assert len(report["data"]["mahadashas"]) == 9
    assert body["birth"]["time_known"] is True
    assert report["greeting"].startswith("Dear Asha")


def test_hindi_locale_returns_hindi_labels(client):
    report = client.post("/api/v1/kundli/dasha", json={"birth": BIRTH, "locale": "hi"}).json()["report"]
    assert report["locale"] == "hi"
    assert report["data"]["moon"]["nakshatra_label"] == "धनिष्ठा"
    assert report["greeting"].startswith("प्रिय")


def test_unknown_birth_time_is_reported_with_uncertainty(client):
    birth = dict(BIRTH, time=None)
    body = client.post("/api/v1/kundli/sade-sati", json={"birth": birth}).json()
    assert body["birth"]["time_known"] is False
    assert set(body["birth"]["uncertainty"]) == {"nakshatra_may_differ", "rashi_may_differ"}
    assert body["report"]["kind"] == "sade_sati" and body["moon"]["rashi_label"]


def test_matching_endpoint(client):
    other = {"date": "1992-02-03", "time": "06:00", "timezone": "Asia/Kolkata"}
    body = client.post("/api/v1/kundli/matching", json={"groom": BIRTH, "bride": other}).json()
    data = body["report"]["data"]
    assert data["max"] == 36 and len(data["koota"]) == 8
    assert 0 <= data["total"] <= 36 and data["band"] in {"high", "middle", "lower"}
    assert body["report"]["headline"]


@pytest.mark.parametrize("patch", [
    {"date": "1850-01-01"}, {"date": "2300-01-01"}, {"time": "25:99"}, {"time": "7pm"},
    {"timezone": "Nowhere/Land"}, {"date": "not-a-date"},
])
def test_invalid_birth_input_is_rejected(client, patch):
    response = client.post("/api/v1/kundli/dasha", json={"birth": dict(BIRTH, **patch)})
    assert response.status_code == 422


def test_a_hostile_name_never_reaches_the_report(client):
    for name in ("<script>alert(1)</script>", "http://evil.example", "I want to kill myself"):
        report = client.post("/api/v1/kundli/dasha", json={"birth": dict(BIRTH, name=name)}).json()["report"]
        assert report["greeting"] is None


def test_config_reports_paid_features_off_by_default(client, monkeypatch):
    monkeypatch.delenv("KUNDLI_PAID_ENABLED", raising=False)
    config = client.get("/api/v1/kundli/config").json()
    assert config["paid_enabled"] is False and config["cadences"] == ["weekly", "biweekly"]


# --- rate limiting --------------------------------------------------------------------------

def test_sliding_window_limiter_blocks_then_recovers():
    now = [0.0]
    limiter = SlidingWindowLimiter(2, 10, clock=lambda: now[0])
    assert limiter.allow("b", "ip") and limiter.allow("b", "ip")
    assert not limiter.allow("b", "ip")
    assert limiter.allow("b", "other-ip")
    now[0] = 11.0
    assert limiter.allow("b", "ip")


def test_rate_limited_dependency_returns_429():
    mini = FastAPI()

    @mini.get("/x", dependencies=[Depends(rate_limited("t", 2, 60))])
    def x():
        return {"ok": True}

    with TestClient(mini) as c:
        assert [c.get("/x").status_code for _ in range(3)] == [200, 200, 429]
        assert c.get("/x").headers["retry-after"] == "60"


# --- signed links ---------------------------------------------------------------------------

def test_token_roundtrip_and_tamper(monkeypatch):
    monkeypatch.setenv("KUNDLI_LINK_SECRET", SECRET)
    subscriber_id = uuid.uuid4()
    token = billing.make_token(subscriber_id)
    assert billing.parse_token(token) == subscriber_id
    flipped = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    assert billing.parse_token(flipped) is None
    assert billing.parse_token("not-a-token") is None
    monkeypatch.setenv("KUNDLI_LINK_SECRET", SECRET + "-other")
    assert billing.parse_token(token) is None


def test_token_needs_a_secret(monkeypatch):
    monkeypatch.delenv("KUNDLI_LINK_SECRET", raising=False)
    with pytest.raises(billing.KundliBillingUnavailable):
        billing.make_token(uuid.uuid4())


# --- checkout -------------------------------------------------------------------------------

def test_checkout_is_off_until_enabled(client, monkeypatch):
    monkeypatch.delenv("KUNDLI_PAID_ENABLED", raising=False)
    response = client.post("/api/v1/kundli/checkout", json=_checkout_body())
    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "paid_disabled" if "detail" in response.json() else True


def test_checkout_requires_consent_and_a_valid_email(client, paid_env):
    assert client.post("/api/v1/kundli/checkout", json=_checkout_body(consent=False)).status_code == 422
    assert client.post("/api/v1/kundli/checkout", json=_checkout_body(email="nope")).status_code == 422
    assert client.post("/api/v1/kundli/checkout", json=_checkout_body(cadence="daily")).status_code == 422


def test_checkout_refuses_a_language_whose_text_is_not_reviewed(client, paid_env, monkeypatch, stripe_calls):
    monkeypatch.setenv("KUNDLI_REVIEWED_LOCALES", "en")
    response = client.post("/api/v1/kundli/checkout", json=_checkout_body(locale="hi"))
    assert response.status_code == 503
    assert stripe_calls == []


def test_checkout_creates_a_pending_subscriber_and_a_stripe_session(client, paid_env, stripe_calls, db_factory):
    response = client.post("/api/v1/kundli/checkout", json=_checkout_body())
    assert response.status_code == 200, response.text
    assert response.json() == {"checkout_url": "https://checkout.example/session"}

    method, path, payload = stripe_calls[0]
    assert (method, path) == ("POST", "/v1/checkout/sessions")
    assert payload["mode"] == "subscription" and payload["line_items"] == [{"price": "price_weekly", "quantity": 1}]
    assert payload["metadata"]["product"] == "kundli" and payload["customer_email"] == "asha@example.com"
    assert payload["subscription_data"]["metadata"] == payload["metadata"]
    assert payload["success_url"] == "https://example.test/kundli/thanks.html"

    with db_factory() as db:
        sub = db.query(KundliSubscriber).one()
        assert sub.status == "pending" and sub.cadence == "weekly" and sub.display_name == "Asha"
        assert str(sub.id) == payload["metadata"]["subscriber_id"]


def test_biweekly_and_hindi_checkout(client, paid_env, stripe_calls):
    response = client.post("/api/v1/kundli/checkout", json=_checkout_body(cadence="biweekly", locale="hi"))
    assert response.status_code == 200
    payload = stripe_calls[0][2]
    assert payload["line_items"][0]["price"] == "price_biweekly"
    assert payload["success_url"].endswith("/kundli/hi/thanks.html")


# --- webhooks and access -----------------------------------------------------------------------

def _event(etype, obj):
    return {"id": f"evt_{uuid.uuid4().hex}", "type": etype, "data": {"object": obj}}


def test_full_subscription_lifecycle(db_factory, paid_env, sent_emails):
    sub_id = _make_active(db_factory, status="pending")
    meta = {"product": "kundli", "subscriber_id": str(sub_id)}
    period_end = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())

    with db_factory() as db:
        result = billing.process_event(db, _event("checkout.session.completed", {
            "object": "checkout.session", "metadata": meta, "customer": "cus_1", "subscription": "sub_1",
            "payment_status": "paid"}))
        db.commit()
        assert result["status"] == "processed"
        sub = db.get(KundliSubscriber, sub_id)
        assert (sub.status, sub.provider_customer_id, sub.provider_subscription_id) == ("active", "cus_1", "sub_1")
        assert len(sent_emails) == 1 and "/kundli/report.html?t=" in sent_emails[0][2]

        # A repeated delivery of the same event must not email twice.
        billing.process_event(db, _event("checkout.session.completed", {
            "metadata": meta, "customer": "cus_1", "subscription": "sub_1", "payment_status": "paid"}))
        assert len(sent_emails) == 1

        billing.process_event(db, _event("customer.subscription.updated", {
            "id": "sub_1", "customer": "cus_1", "metadata": meta, "status": "active",
            "current_period_end": period_end, "cancel_at_period_end": True}))
        db.commit()
        sub = db.get(KundliSubscriber, sub_id)
        assert sub.cancel_at_period_end is True and sub.current_period_end is not None and billing.has_access(sub)

        # invoice events carry no metadata: the subscription id finds the subscriber.
        billing.process_event(db, _event("invoice.payment_failed", {"subscription": "sub_1"}))
        assert db.get(KundliSubscriber, sub_id).status == "past_due"
        assert billing.has_access(db.get(KundliSubscriber, sub_id))  # inside the grace window
        billing.process_event(db, _event("invoice.paid", {"subscription": "sub_1"}))
        assert db.get(KundliSubscriber, sub_id).status == "active"

        billing.process_event(db, _event("customer.subscription.deleted", {
            "id": "sub_1", "customer": "cus_1", "metadata": meta, "status": "canceled",
            "current_period_end": int((datetime.now(timezone.utc) - timedelta(days=1)).timestamp())}))
        sub = db.get(KundliSubscriber, sub_id)
        assert sub.status == "canceled" and not billing.has_access(sub)


def test_events_of_other_products_are_not_taken(db_factory, paid_env):
    with db_factory() as db:
        assert billing.process_event(db, _event("customer.subscription.updated", {
            "id": "sub_x", "metadata": {"astrologer_id": str(uuid.uuid4())}})) is None
        assert billing.process_event(db, _event("invoice.paid", {"subscription": "sub_unknown"})) is None
        assert billing.is_kundli_event(_event("x", {"metadata": {"product": "kundli"}}))
        assert not billing.is_kundli_event(_event("x", {"metadata": {}}))


def test_access_rules():
    now = datetime(2026, 10, 26, 12, 0)
    sub = KundliSubscriber(status="active")
    assert billing.has_access(sub, now)
    sub = KundliSubscriber(status="pending")
    assert not billing.has_access(sub, now)
    sub = KundliSubscriber(status="canceled", current_period_end=now + timedelta(days=2))
    assert billing.has_access(sub, now)
    sub = KundliSubscriber(status="past_due", current_period_end=now - timedelta(days=5))
    assert not billing.has_access(sub, now)


def _signed(payload: dict, secret: str):
    raw = json.dumps(payload).encode()
    stamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), f"{stamp}.".encode() + raw, hashlib.sha256).hexdigest()
    return raw, {"Stripe-Signature": f"t={stamp},v1={signature}", "Content-Type": "application/json"}


def test_stripe_webhook_route_hands_kundli_events_to_the_kundli_table(client, db_factory, paid_env, sent_emails, monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "stripe")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    sub_id = _make_active(db_factory, status="pending")
    event = _event("checkout.session.completed", {
        "object": "checkout.session", "metadata": {"product": "kundli", "subscriber_id": str(sub_id)},
        "customer": "cus_9", "subscription": "sub_9", "payment_status": "paid"})
    event["livemode"] = False
    raw, headers = _signed(event, "whsec_test")
    response = client.post("/api/v1/webhooks/billing/stripe", content=raw, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "processed"
    with db_factory() as db:
        assert db.get(KundliSubscriber, sub_id).status == "active"


# --- the subscriber's report, portal and erasure --------------------------------------------------

def test_report_requires_a_valid_token_and_an_active_subscription(client, db_factory, paid_env):
    assert client.post("/api/v1/kundli/report", json={"token": "x" * 24}).status_code == 404

    pending = _make_active(db_factory, status="pending")
    assert client.post("/api/v1/kundli/report", json={"token": billing.make_token(pending)}).status_code == 403

    active = _make_active(db_factory, status="active")
    response = client.post("/api/v1/kundli/report", json={"token": billing.make_token(active)})
    assert response.status_code == 200, response.text
    bundle = response.json()
    assert bundle["dasha"]["sections"] and bundle["sade_sati"]["sections"] and bundle["week"]["sections"][0]["items"]
    assert bundle["subscription"]["status"] == "active"


def test_report_in_hindi(client, db_factory, paid_env):
    active = _make_active(db_factory, status="active", locale="hi")
    bundle = client.post("/api/v1/kundli/report", json={"token": billing.make_token(active)}).json()
    assert bundle["dasha"]["locale"] == "hi" and bundle["week"]["title"] == "आपका आने वाला सप्ताह"


def test_portal_link(client, db_factory, paid_env, stripe_calls):
    no_customer = _make_active(db_factory, status="active")
    assert client.post("/api/v1/kundli/portal", json={"token": billing.make_token(no_customer)}).status_code == 404
    with_customer = _make_active(db_factory, status="active", provider_customer_id="cus_7")
    response = client.post("/api/v1/kundli/portal", json={"token": billing.make_token(with_customer)})
    assert response.json() == {"url": "https://portal.example/session"}
    assert stripe_calls[-1][2]["customer"] == "cus_7"


def test_erase_cancels_stripe_then_deletes(client, db_factory, paid_env, stripe_calls):
    sub_id = _make_active(db_factory, status="active", provider_subscription_id="sub_55")
    response = client.post("/api/v1/kundli/erase", json={"token": billing.make_token(sub_id)})
    assert response.json() == {"status": "erased"}
    assert ("DELETE", "/v1/subscriptions/sub_55", None) in stripe_calls
    with db_factory() as db:
        assert db.get(KundliSubscriber, sub_id) is None


def test_erase_keeps_the_row_when_stripe_cannot_cancel(client, db_factory, paid_env, monkeypatch):
    def boom(self, method, path, payload=None):
        raise RuntimeError("stripe down")

    monkeypatch.setattr("app.services.billing_service.StripeBillingProvider._api_request", boom)
    sub_id = _make_active(db_factory, status="active", provider_subscription_id="sub_56")
    response = client.post("/api/v1/kundli/erase", json={"token": billing.make_token(sub_id)})
    assert response.status_code == 502
    with db_factory() as db:
        assert db.get(KundliSubscriber, sub_id) is not None


# --- digests ----------------------------------------------------------------------------------------

def test_digest_goes_to_due_subscribers_only_once_per_interval(db_factory, paid_env, sent_emails):
    now = datetime(2026, 10, 26, 9, 0)
    due = _make_active(db_factory, status="active", last_digest_sent_at=now - timedelta(days=7))
    recent = _make_active(db_factory, status="active", last_digest_sent_at=now - timedelta(days=2))
    fortnight = _make_active(db_factory, status="active", cadence="biweekly", last_digest_sent_at=now - timedelta(days=8))
    canceled = _make_active(db_factory, status="canceled", current_period_end=now - timedelta(days=1))
    fresh = _make_active(db_factory, status="active", locale="hi")  # never emailed yet

    with db_factory() as db:
        result = billing.send_due_digests(db, now)
        db.commit()
    assert result["sent"] == 2 and result["failed"] == 0
    assert len(sent_emails) == 2
    assert any("आने वाले" in subject for _, subject, _ in sent_emails)

    with db_factory() as db:
        assert db.get(KundliSubscriber, due).last_digest_sent_at == now
        assert db.get(KundliSubscriber, recent).last_digest_sent_at == now - timedelta(days=2)
        assert db.get(KundliSubscriber, fortnight).last_digest_sent_at == now - timedelta(days=8)
        assert db.get(KundliSubscriber, canceled).last_digest_sent_at is None
        assert db.get(KundliSubscriber, fresh).last_digest_sent_at == now
        again = billing.send_due_digests(db, now + timedelta(hours=1))
    assert again["sent"] == 0


# --- scheduler endpoint ------------------------------------------------------------------------------

def test_digest_endpoint_is_hidden_without_the_secret(client, db_factory, monkeypatch, sent_emails):
    monkeypatch.setenv("KUNDLI_CRON_SECRET", "cron-secret-0123456789")
    _make_active(db_factory, status="active")
    assert client.post("/api/v1/kundli/internal/send-digests").status_code == 404
    assert client.post("/api/v1/kundli/internal/send-digests", headers={"X-Kundli-Cron": "wrong"}).status_code == 404
    assert sent_emails == []


def test_digest_endpoint_runs_with_the_secret(client, db_factory, paid_env, monkeypatch, sent_emails):
    monkeypatch.setenv("KUNDLI_CRON_SECRET", "cron-secret-0123456789")
    _make_active(db_factory, status="active")
    response = client.post("/api/v1/kundli/internal/send-digests", headers={"X-Kundli-Cron": "cron-secret-0123456789"})
    assert response.status_code == 200 and response.json()["sent"] == 1
    again = client.post("/api/v1/kundli/internal/send-digests", headers={"X-Kundli-Cron": "cron-secret-0123456789"})
    assert again.json()["sent"] == 0


def test_digest_endpoint_is_off_when_no_secret_is_configured(client, monkeypatch):
    monkeypatch.delenv("KUNDLI_CRON_SECRET", raising=False)
    assert client.post("/api/v1/kundli/internal/send-digests", headers={"X-Kundli-Cron": ""}).status_code == 404
