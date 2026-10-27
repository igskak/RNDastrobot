"""Paid kundli forecasts for visitors without an account.

A visitor buys a weekly or fortnightly forecast through Stripe Checkout (same Managed Payments
setup as the workspace plans) and receives a signed link; the link is the only credential.
Webhooks tagged ``metadata.product == "kundli"`` are handled here and never reach the
workspace billing tables.

Everything on the money path is off until KUNDLI_PAID_ENABLED is set, together with
KUNDLI_LINK_SECRET and a Stripe price id per cadence.
"""
from __future__ import annotations

import hmac
import os
import uuid
from datetime import datetime, time as time_type, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import mailer
from app.database.models import KundliSubscriber
from app.models.kundli import CheckoutRequest
from app.services import b2c_safety_policy as safety
from app.services import signed_links
from app.services import vedic_content as content
from app.services import vedic_report_service as reports
from app.services import vedic_service as vedic
from app.services.billing_service import BillingProviderError, StripeBillingProvider, provider_http_error

KUNDLI_PRODUCT = "kundli"
GRACE_PAST_DUE = timedelta(days=3)
CADENCE_INTERVAL = {"weekly": timedelta(days=7), "biweekly": timedelta(days=14)}
_DIGEST_SLACK = timedelta(hours=12)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class KundliBillingUnavailable(HTTPException):
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "SERVICE_UNAVAILABLE", "detail": {"reason": reason}},
        )


def paid_enabled() -> bool:
    return os.getenv("KUNDLI_PAID_ENABLED", "").strip().lower() in {"1", "true", "yes"}


def _secret() -> bytes:
    secret = os.getenv("KUNDLI_LINK_SECRET", "").strip()
    if len(secret) < 16:
        raise KundliBillingUnavailable("link_secret_missing")
    return secret.encode("utf-8")


def price_id_for(cadence: str) -> str:
    price = os.getenv("KUNDLI_STRIPE_PRICE_WEEKLY" if cadence == "weekly" else "KUNDLI_STRIPE_PRICE_BIWEEKLY", "").strip()
    if not price:
        raise KundliBillingUnavailable("price_missing")
    return price


def public_config() -> Dict[str, Any]:
    return {
        "paid_enabled": paid_enabled(),
        "cadences": ["weekly", "biweekly"],
        "price_labels": {
            "weekly": os.getenv("KUNDLI_PRICE_LABEL_WEEKLY", ""),
            "biweekly": os.getenv("KUNDLI_PRICE_LABEL_BIWEEKLY", ""),
        },
        "reviewed_locales": list(content.reviewed_locales()),
    }


# --- signed links ---------------------------------------------------------------------

def make_token(subscriber_id: uuid.UUID) -> str:
    return signed_links.make_token(subscriber_id, _secret())


def parse_token(token: str) -> Optional[uuid.UUID]:
    return signed_links.parse_token(token, _secret())


def find_by_token(db: Session, token: str) -> Optional[KundliSubscriber]:
    subscriber_id = parse_token(token)
    if subscriber_id is None:
        return None
    return db.query(KundliSubscriber).filter(KundliSubscriber.id == subscriber_id).first()


def has_access(sub: KundliSubscriber, now: Optional[datetime] = None) -> bool:
    now = now or utcnow()
    if sub.status == "active":
        return True
    if sub.status == "past_due":
        return sub.current_period_end is not None and now <= sub.current_period_end + GRACE_PAST_DUE
    if sub.status == "canceled":
        return sub.current_period_end is not None and now <= sub.current_period_end
    return False


def _base_url(fallback: str = "") -> str:
    return (os.getenv("FRONTEND_BASE_URL", "").strip() or os.getenv("APP_BASE_URL", "").strip() or fallback).rstrip("/")


def _page(locale: str, name: str) -> str:
    return f"/kundli/hi/{name}.html" if locale == "hi" else f"/kundli/{name}.html"


# --- checkout -------------------------------------------------------------------------

def create_checkout(db: Session, request: CheckoutRequest, *, fallback_base_url: str = "") -> str:
    if not paid_enabled():
        raise KundliBillingUnavailable("paid_disabled")
    locale = reports.normalize_locale(request.locale)
    if locale not in content.reviewed_locales():
        raise KundliBillingUnavailable("locale_not_reviewed")
    price_id = price_id_for(request.cadence)
    _secret()  # fail before any row or Stripe session is created
    base = _base_url(fallback_base_url)
    if not base:
        raise KundliBillingUnavailable("base_url_missing")

    # Validate the birth data before anything is stored or charged.
    vedic.moon_for_local_birth(request.birth.date, request.birth.time_tuple(), request.birth.timezone)
    birth_time = request.birth.time_tuple()
    sub = KundliSubscriber(
        id=uuid.uuid4(),
        email=request.email.lower(),
        locale=locale,
        display_name=safety.sanitize_display_name(request.birth.name),
        birth_date=request.birth.date,
        birth_time=time_type(*birth_time) if birth_time else None,
        timezone=request.birth.timezone,
        place_label=(request.place_label or "")[:200] or None,
        cadence=request.cadence,
        status="pending",
        provider="stripe",
        consent_at=utcnow(),
    )
    db.add(sub)
    db.flush()

    metadata = {"product": KUNDLI_PRODUCT, "subscriber_id": str(sub.id), "cadence": request.cadence}
    payload: Dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "managed_payments": {"enabled": True},
        "customer_email": sub.email,
        "client_reference_id": f"kundli:{sub.id}",
        "success_url": f"{base}{_page(locale, 'thanks')}",
        "cancel_url": f"{base}{_page(locale, 'index')}",
        "metadata": metadata,
        "subscription_data": {"metadata": metadata},
        "allow_promotion_codes": True,
    }
    try:
        response = StripeBillingProvider()._api_request("POST", "/v1/checkout/sessions", payload)
    except BillingProviderError as exc:
        raise provider_http_error(exc) from exc
    url = response.get("url")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "UPSTREAM_ERROR", "detail": {"reason": "no_checkout_url"}},
        )
    return str(url)


# --- webhooks -------------------------------------------------------------------------

def _nested(data: Any, *keys: str) -> Any:
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data


def _from_unix(value: Any) -> Optional[datetime]:
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


_STRIPE_STATUS = {
    "active": "active", "trialing": "active",
    "past_due": "past_due", "unpaid": "past_due",
    "canceled": "canceled", "incomplete_expired": "canceled",
    "incomplete": "pending",
}


def _subscriber_for_event(db: Session, obj: Dict[str, Any], etype: str) -> Optional[KundliSubscriber]:
    metadata = obj.get("metadata") or {}
    if metadata.get("product") == KUNDLI_PRODUCT:
        try:
            return db.query(KundliSubscriber).filter(KundliSubscriber.id == uuid.UUID(str(metadata.get("subscriber_id")))).first()
        except ValueError:
            return None
    if etype.startswith("invoice."):
        subscription_id = str(obj.get("subscription") or _nested(obj, "parent", "subscription_details", "subscription") or "")
        if subscription_id:
            return db.query(KundliSubscriber).filter(
                KundliSubscriber.provider == "stripe",
                KundliSubscriber.provider_subscription_id == subscription_id,
            ).first()
    return None


def is_kundli_event(payload: Dict[str, Any]) -> bool:
    obj = _nested(payload, "data", "object") or {}
    return (obj.get("metadata") or {}).get("product") == KUNDLI_PRODUCT


def process_event(db: Session, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Apply a Stripe event to a kundli subscriber. None means the event is not ours."""
    etype = str(payload.get("type") or "")
    obj = _nested(payload, "data", "object") or {}
    sub = _subscriber_for_event(db, obj, etype)
    if sub is None:
        return None

    if etype == "checkout.session.completed":
        sub.provider_customer_id = str(obj.get("customer") or sub.provider_customer_id or "") or None
        sub.provider_subscription_id = str(obj.get("subscription") or sub.provider_subscription_id or "") or None
        if obj.get("payment_status") in ("paid", "no_payment_required"):
            sub.status = "active"
        db.flush()
        send_welcome(db, sub)
    elif etype.startswith("customer.subscription."):
        sub.provider_subscription_id = str(obj.get("id") or sub.provider_subscription_id or "") or None
        sub.provider_customer_id = str(obj.get("customer") or sub.provider_customer_id or "") or None
        if etype.endswith(".deleted"):
            sub.status = "canceled"
        else:
            sub.status = _STRIPE_STATUS.get(str(obj.get("status") or ""), sub.status)
        first_item = (_nested(obj, "items", "data") or [{}])[0]
        period_end = _from_unix(obj.get("current_period_end") or _nested(first_item, "current_period_end"))
        if period_end:
            sub.current_period_end = period_end
        sub.cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
        db.flush()
        if sub.status == "active":
            send_welcome(db, sub)
    elif etype == "invoice.payment_failed":
        sub.status = "past_due"
        db.flush()
    elif etype in ("invoice.paid", "invoice.payment_succeeded"):
        if sub.status in ("past_due", "pending"):
            sub.status = "active"
        db.flush()
    else:
        return {"status": "ignored", "event_type": etype}
    return {"status": "processed", "event_type": etype, "subscriber_id": str(sub.id)}


# --- reports and email ------------------------------------------------------------------

def _birth_inputs(sub: KundliSubscriber):
    birth_time = (sub.birth_time.hour, sub.birth_time.minute) if sub.birth_time else None
    return sub.birth_date, birth_time, sub.timezone


def build_bundle(sub: KundliSubscriber, now: Optional[datetime] = None) -> Dict[str, Any]:
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    birth_date, birth_time, tz_name = _birth_inputs(sub)
    moon, birth_utc, time_known, uncertainty = vedic.moon_for_local_birth(birth_date, birth_time, tz_name)
    dasha = vedic.vimshottari(moon.longitude, birth_utc, as_of=now_utc)
    sade = vedic.sade_sati(moon.rashi, birth_utc, as_of=now_utc)
    name = safety.sanitize_display_name(sub.display_name)
    return {
        "dasha": reports.build_dasha(dasha, sub.locale, name, full=True, as_of=now_utc),
        "sade_sati": reports.build_sade_sati(sade, sub.locale, name, full=True),
        "week": reports.build_week(moon.rashi, dasha, sub.locale, tz_name, name, start=now_utc.date()),
        "time_known": time_known,
        "uncertainty": uncertainty,
        "subscription": {
            "status": sub.status,
            "cadence": sub.cadence,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "cancel_at_period_end": bool(sub.cancel_at_period_end),
        },
    }


def render_text(report: Dict[str, Any]) -> str:
    lines = [report["title"], ""]
    if report.get("greeting"):
        lines += [report["greeting"], ""]
    lines += [report["headline"], ""]
    for section in report["sections"]:
        lines.append(section["title"])
        lines += section["paragraphs"]
        lines += [f"- {item['label']}: {item['text']}" for item in section["items"]]
        lines.append("")
    lines.append(report["disclaimer"])
    return "\n".join(lines)


def _links(sub: KundliSubscriber) -> Dict[str, str]:
    base = _base_url()
    token = quote(make_token(sub.id))
    return {
        "link": f"{base}{_page(sub.locale, 'report')}?t={token}",
        "manage_link": f"{base}{_page(sub.locale, 'report')}?t={token}#manage",
    }


def _send(sub: KundliSubscriber, subject: str, body: str) -> bool:
    safety.assert_safe(subject, sub.locale)
    safety.assert_safe(body.replace(_links(sub)["link"], "").replace(_links(sub)["manage_link"], ""), sub.locale)
    return mailer.send_transactional_email(recipient=sub.email, subject=subject, body_text=body)


def send_welcome(db: Session, sub: KundliSubscriber) -> bool:
    if sub.welcome_sent_at is not None or sub.status != "active":
        return False
    links = _links(sub)
    body = "\n\n".join([
        content.pick(content.EMAIL["welcome_body"], sub.locale).format(link=links["link"]),
        content.pick(content.EMAIL["footer"], sub.locale).format(manage_link=links["manage_link"]),
        safety.DISCLAIMER[sub.locale],
    ])
    if _send(sub, content.pick(content.EMAIL["welcome_subject"], sub.locale), body):
        sub.welcome_sent_at = sub.last_digest_sent_at = utcnow()
        db.flush()
        return True
    logger.warning("Kundli welcome email was not delivered for subscriber {}", sub.id)
    return False


def send_due_digests(db: Session, now: Optional[datetime] = None, limit: int = 500) -> Dict[str, int]:
    """Email every active subscriber whose next forecast is due. Run from a scheduler."""
    now = now or utcnow()
    sent = failed = skipped = 0
    rows = db.query(KundliSubscriber).filter(KundliSubscriber.status == "active").limit(limit).all()
    for sub in rows:
        interval = CADENCE_INTERVAL.get(sub.cadence, CADENCE_INTERVAL["weekly"])
        if sub.last_digest_sent_at and now - sub.last_digest_sent_at < interval - _DIGEST_SLACK:
            skipped += 1
            continue
        if not has_access(sub, now):
            skipped += 1
            continue
        try:
            bundle = build_bundle(sub, now.replace(tzinfo=timezone.utc))
            links = _links(sub)
            body = "\n\n".join([
                content.pick(content.EMAIL["digest_body"], sub.locale).format(
                    summary=render_text(bundle["week"]), link=links["link"]),
                content.pick(content.EMAIL["footer"], sub.locale).format(manage_link=links["manage_link"]),
            ])
            if _send(sub, content.pick(content.EMAIL["digest_subject"], sub.locale), body):
                sub.last_digest_sent_at = now
                sent += 1
            else:
                failed += 1
        except Exception as exc:  # one bad row must not stop the run
            logger.warning("Kundli digest failed for subscriber {}: {}", sub.id, exc)
            failed += 1
    db.flush()
    return {"sent": sent, "failed": failed, "skipped": skipped}


_DIGEST_LOCK_KEY = 70417001  # arbitrary, but stable: one digest run at a time across workers


def run_digest_job(db: Session) -> Dict[str, Any]:
    """send_due_digests behind a database lock, for the scheduler endpoint.

    Two runs at once (two workers, or a retried request) would email twice; on PostgreSQL the
    transaction-scoped advisory lock makes the second one stand down.
    """
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        acquired = db.execute(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": _DIGEST_LOCK_KEY}).scalar()
        if not acquired:
            return {"sent": 0, "failed": 0, "skipped": 0, "locked": True}
    return send_due_digests(db)


def cron_secret_matches(provided: str) -> bool:
    secret = os.getenv("KUNDLI_CRON_SECRET", "").strip()
    return len(secret) >= 16 and hmac.compare_digest(provided or "", secret)


# --- self service ---------------------------------------------------------------------

def create_portal_url(sub: KundliSubscriber) -> str:
    if not sub.provider_customer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "detail": {"reason": "no_customer"}},
        )
    base = _base_url()
    try:
        response = StripeBillingProvider()._api_request(
            "POST", "/v1/billing_portal/sessions",
            {"customer": sub.provider_customer_id, "return_url": f"{base}{_page(sub.locale, 'report')}"},
        )
    except BillingProviderError as exc:
        raise provider_http_error(exc) from exc
    url = response.get("url")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "UPSTREAM_ERROR", "detail": {"reason": "no_portal_url"}},
        )
    return str(url)


def erase(db: Session, sub: KundliSubscriber) -> None:
    """Delete the visitor's data. The Stripe subscription is cancelled first when there is one."""
    if sub.provider_subscription_id and sub.status in ("active", "past_due"):
        try:
            StripeBillingProvider()._api_request("DELETE", f"/v1/subscriptions/{sub.provider_subscription_id}")
        except Exception as exc:
            # Never leave a charging subscription behind a deleted row.
            logger.warning("Could not cancel Stripe subscription for erase: {}", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error_code": "UPSTREAM_ERROR", "detail": {"reason": "cancel_failed"}},
            ) from exc
    db.delete(sub)
    db.flush()
