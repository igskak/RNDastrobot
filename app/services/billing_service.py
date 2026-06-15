"""Provider-neutral billing and Paddle adapter."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib import error as urlerror
from urllib import request as urlrequest
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import utcnow
from app.database.models import (
    Astrologer,
    BillingCustomer,
    BillingEvent,
    BillingPriceMap,
    BillingSubscription,
)
from app.services.entitlements_service import PLAN_PRO, PLAN_STANDARD, normalize_plan_code


BILLING_PROVIDER_PADDLE = "paddle"
PAID_PLAN_CODES = {PLAN_STANDARD, PLAN_PRO}
SUPPORTED_INTERVALS = {"monthly", "yearly"}
ACCESS_STATUSES = {"active", "trialing", "past_due"}


@dataclass(frozen=True)
class BillingCheckout:
    checkout_url: str
    provider: str


@dataclass(frozen=True)
class BillingPortal:
    portal_url: str
    provider: str


@dataclass(frozen=True)
class NormalizedBillingEvent:
    provider_event_id: str
    event_type: str
    action: str
    subscription_id: Optional[str]
    customer_id: Optional[str]
    astrologer_id: Optional[UUID]
    plan_code: Optional[str]
    interval: Optional[str]
    status: Optional[str]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancel_at_period_end: bool
    coupon_code: Optional[str]
    raw_payload: Dict[str, Any]


def billing_provider_name() -> str:
    return os.getenv("BILLING_PROVIDER", BILLING_PROVIDER_PADDLE).strip().lower() or BILLING_PROVIDER_PADDLE


def is_paid_plan(plan_code: Optional[str]) -> bool:
    return normalize_plan_code(plan_code) in PAID_PLAN_CODES


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return _as_utc(value)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _nested(payload: Dict[str, Any], *keys: str) -> Any:
    current: Any = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _normalize_status(provider_status: Optional[str]) -> str:
    status_value = str(provider_status or "").strip().lower()
    if status_value in {"active", "trialing", "past_due", "paused", "canceled", "cancelled", "expired"}:
        return "canceled" if status_value == "cancelled" else status_value
    if status_value in {"deleted"}:
        return "expired"
    return status_value or "unknown"


def _normalize_interval(payload: Dict[str, Any]) -> Optional[str]:
    first_item = (payload.get("items") or [{}])[0] if isinstance(payload.get("items"), list) else {}
    candidates = [
        _nested(payload, "billing_cycle", "interval"),
        _nested(first_item, "price", "billing_cycle", "interval"),
        payload.get("interval"),
    ]
    for candidate in candidates:
        value = str(candidate or "").strip().lower()
        if value in {"month", "monthly"}:
            return "monthly"
        if value in {"year", "yearly", "annual"}:
            return "yearly"
    return None


def _normalize_plan_from_price(db: Session, provider: str, price_id: Optional[str]) -> Optional[str]:
    if not price_id:
        return None
    row = (
        db.query(BillingPriceMap)
        .filter(
            BillingPriceMap.provider == provider,
            BillingPriceMap.provider_price_id == price_id,
            BillingPriceMap.is_active.is_(True),
        )
        .first()
    )
    return row.plan_code if row else None


def _active_access_until(subscription: BillingSubscription) -> Optional[datetime]:
    return _as_utc(subscription.access_until or subscription.current_period_end)


def subscription_has_access(subscription: BillingSubscription, now: Optional[datetime] = None) -> bool:
    normalized_status = _normalize_status(subscription.status)
    access_until = _active_access_until(subscription)
    current_time = now or utcnow()
    if normalized_status == "canceled" and subscription.cancel_at_period_end and access_until:
        return access_until > current_time
    if normalized_status not in ACCESS_STATUSES:
        return False
    if normalized_status in {"active", "trialing"} and not access_until:
        return True
    if not access_until:
        return False
    return access_until > current_time


def get_active_subscription(db: Session, astrologer_id) -> Optional[BillingSubscription]:
    now = utcnow()
    subscriptions = (
        db.query(BillingSubscription)
        .filter(BillingSubscription.astrologer_id == astrologer_id)
        .order_by(BillingSubscription.updated_at.desc().nullslast(), BillingSubscription.created_at.desc().nullslast())
        .all()
    )
    for subscription in subscriptions:
        if subscription_has_access(subscription, now):
            return subscription
    return None


def get_effective_plan_code(db: Session, astrologer: Astrologer) -> str:
    active_subscription = get_active_subscription(db, astrologer.id)
    if active_subscription and active_subscription.plan_code in PAID_PLAN_CODES:
        return active_subscription.plan_code
    return normalize_plan_code(getattr(astrologer, "plan_code", None))


def get_billing_summary(db: Session, astrologer: Astrologer) -> Dict[str, Any]:
    subscription = (
        db.query(BillingSubscription)
        .filter(BillingSubscription.astrologer_id == astrologer.id)
        .order_by(BillingSubscription.updated_at.desc().nullslast(), BillingSubscription.created_at.desc().nullslast())
        .first()
    )
    if not subscription:
        return {"provider": billing_provider_name(), "subscription": None}

    return {
        "provider": subscription.provider,
        "subscription": {
            "plan_code": subscription.plan_code,
            "interval": subscription.interval,
            "status": subscription.status,
            "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            "cancel_at_period_end": bool(subscription.cancel_at_period_end),
            "access_until": subscription.access_until.isoformat() if subscription.access_until else None,
            "coupon_code": subscription.coupon_code,
        },
    }


def get_price_id(db: Session, *, provider: str, plan_code: str, interval: str) -> str:
    row = (
        db.query(BillingPriceMap)
        .filter(
            BillingPriceMap.provider == provider,
            BillingPriceMap.plan_code == plan_code,
            BillingPriceMap.interval == interval,
            BillingPriceMap.is_active.is_(True),
        )
        .first()
    )
    if row:
        return row.provider_price_id

    env_key = f"PADDLE_PRICE_{plan_code.upper()}_{interval.upper()}"
    env_value = os.getenv(env_key, "").strip()
    if env_value:
        return env_value

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Billing price is not configured for {plan_code}/{interval}.",
    )


class BillingProvider:
    provider = BILLING_PROVIDER_PADDLE

    def create_checkout(self, db: Session, *, astrologer: Astrologer, plan_code: str, interval: str, coupon_code: Optional[str]) -> BillingCheckout:
        raise NotImplementedError

    def create_customer_portal(self, db: Session, *, astrologer: Astrologer) -> BillingPortal:
        raise NotImplementedError

    def verify_webhook(self, raw_body: bytes, headers: Dict[str, str]) -> Dict[str, Any]:
        raise NotImplementedError

    def normalize_event(self, db: Session, payload: Dict[str, Any]) -> NormalizedBillingEvent:
        raise NotImplementedError


class PaddleBillingProvider(BillingProvider):
    provider = BILLING_PROVIDER_PADDLE

    def __init__(self) -> None:
        self.api_key = os.getenv("PADDLE_API_KEY", "").strip()
        env = os.getenv("PADDLE_ENV", "sandbox").strip().lower()
        default_base = "https://sandbox-api.paddle.com" if env != "production" else "https://api.paddle.com"
        self.api_base_url = os.getenv("PADDLE_API_BASE_URL", default_base).rstrip("/")
        self.webhook_secret = os.getenv("PADDLE_WEBHOOK_SECRET", "").strip()

    def _api_request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.api_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Paddle API key is not configured.")

        body = json.dumps(payload or {}).encode("utf-8") if payload is not None else None
        req = urlrequest.Request(
            f"{self.api_base_url}{path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urlrequest.urlopen(req, timeout=20) as response:
                return json.loads(response.read().decode("utf-8") or "{}")
        except urlerror.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Paddle API error: {message}") from exc
        except urlerror.URLError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Paddle API unavailable: {exc.reason}") from exc

    def create_checkout(self, db: Session, *, astrologer: Astrologer, plan_code: str, interval: str, coupon_code: Optional[str]) -> BillingCheckout:
        price_id = get_price_id(db, provider=self.provider, plan_code=plan_code, interval=interval)
        payload: Dict[str, Any] = {
            "items": [{"price_id": price_id, "quantity": 1}],
            "customer": {"email": astrologer.email},
            "custom_data": {
                "astrologer_id": str(astrologer.id),
                "plan_code": plan_code,
                "interval": interval,
            },
        }
        if coupon_code:
            payload["discount_id"] = coupon_code.strip()
            payload["custom_data"]["coupon_code"] = coupon_code.strip()

        response = self._api_request("POST", "/transactions", payload)
        data = response.get("data") or response
        checkout_url = (
            _nested(data, "checkout", "url")
            or data.get("checkout_url")
            or data.get("url")
        )
        if not checkout_url:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Paddle did not return a checkout URL.")
        return BillingCheckout(checkout_url=str(checkout_url), provider=self.provider)

    def create_customer_portal(self, db: Session, *, astrologer: Astrologer) -> BillingPortal:
        subscription = get_active_subscription(db, astrologer.id) or (
            db.query(BillingSubscription)
            .filter(BillingSubscription.astrologer_id == astrologer.id)
            .order_by(BillingSubscription.updated_at.desc().nullslast())
            .first()
        )
        if not subscription:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No billing subscription found.")
        response = self._api_request(
            "POST",
            "/customer-portal-sessions",
            {"subscription_ids": [subscription.provider_subscription_id]},
        )
        data = response.get("data") or response
        portal_url = data.get("url") or _nested(data, "urls", "general") or _nested(data, "customer_portal", "url")
        if not portal_url:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Paddle did not return a portal URL.")
        return BillingPortal(portal_url=str(portal_url), provider=self.provider)

    def verify_webhook(self, raw_body: bytes, headers: Dict[str, str]) -> Dict[str, Any]:
        if not self.webhook_secret:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Paddle webhook secret is not configured.")
        signature_header = headers.get("paddle-signature") or headers.get("Paddle-Signature") or ""
        parts = {}
        for item in signature_header.split(";"):
            if "=" in item:
                key, value = item.split("=", 1)
                parts[key.strip()] = value.strip()
        timestamp = parts.get("ts")
        signature = parts.get("h1")
        if not timestamp or not signature:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Paddle webhook signature.")
        signed_payload = f"{timestamp}:".encode("utf-8") + raw_body
        expected = hmac.new(self.webhook_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Paddle webhook signature.")
        return json.loads(raw_body.decode("utf-8") or "{}")

    def normalize_event(self, db: Session, payload: Dict[str, Any]) -> NormalizedBillingEvent:
        data = payload.get("data") or {}
        event_id = str(payload.get("event_id") or payload.get("id") or data.get("id") or "")
        event_type = str(payload.get("event_type") or payload.get("type") or "")
        custom_data = data.get("custom_data") or {}
        first_item = (data.get("items") or [{}])[0] if isinstance(data.get("items"), list) else {}
        price_id = _nested(first_item, "price", "id") or first_item.get("price_id") or data.get("price_id")
        raw_plan_code = custom_data.get("plan_code") or _normalize_plan_from_price(db, self.provider, price_id)
        plan_code = normalize_plan_code(raw_plan_code) if raw_plan_code else None
        if plan_code not in PAID_PLAN_CODES:
            plan_code = None
        astrologer_id = None
        try:
            astrologer_id = UUID(str(custom_data.get("astrologer_id"))) if custom_data.get("astrologer_id") else None
        except ValueError:
            astrologer_id = None
        return NormalizedBillingEvent(
            provider_event_id=event_id or f"{event_type}:{data.get('id')}",
            event_type=event_type,
            action=event_type.split(".")[-1] if event_type else "unknown",
            subscription_id=str(data.get("id") or data.get("subscription_id") or ""),
            customer_id=str(data.get("customer_id") or ""),
            astrologer_id=astrologer_id,
            plan_code=plan_code,
            interval=_normalize_interval(data) or custom_data.get("interval"),
            status=_normalize_status(data.get("status")),
            current_period_start=_parse_datetime(data.get("current_billing_period", {}).get("starts_at")),
            current_period_end=_parse_datetime(data.get("current_billing_period", {}).get("ends_at")),
            cancel_at_period_end=bool(data.get("scheduled_change")),
            coupon_code=str(data.get("discount", {}).get("code") or custom_data.get("coupon_code") or "") or None,
            raw_payload=payload,
        )


def get_billing_provider() -> BillingProvider:
    provider = billing_provider_name()
    if provider == BILLING_PROVIDER_PADDLE:
        return PaddleBillingProvider()
    raise RuntimeError(f"Unsupported billing provider: {provider}")


def upsert_subscription_from_event(db: Session, event: NormalizedBillingEvent) -> Optional[BillingSubscription]:
    if not event.subscription_id:
        return None

    astrologer = db.query(Astrologer).filter(Astrologer.id == event.astrologer_id).first() if event.astrologer_id else None
    if not astrologer and event.customer_id:
        customer = (
            db.query(BillingCustomer)
            .filter(BillingCustomer.provider == BILLING_PROVIDER_PADDLE, BillingCustomer.provider_customer_id == event.customer_id)
            .first()
        )
        astrologer = customer.astrologer if customer else None
    if not astrologer or not event.plan_code:
        return None

    customer_row = None
    if event.customer_id:
        customer_row = (
            db.query(BillingCustomer)
            .filter(BillingCustomer.provider == BILLING_PROVIDER_PADDLE, BillingCustomer.provider_customer_id == event.customer_id)
            .first()
        )
        if not customer_row:
            customer_row = BillingCustomer(
                astrologer_id=astrologer.id,
                provider=BILLING_PROVIDER_PADDLE,
                provider_customer_id=event.customer_id,
                email=astrologer.email,
                raw_provider_payload=event.raw_payload.get("data"),
            )
            db.add(customer_row)
            db.flush()

    subscription = (
        db.query(BillingSubscription)
        .filter(
            BillingSubscription.provider == BILLING_PROVIDER_PADDLE,
            BillingSubscription.provider_subscription_id == event.subscription_id,
        )
        .first()
    )
    if not subscription:
        subscription = BillingSubscription(
            astrologer_id=astrologer.id,
            provider=BILLING_PROVIDER_PADDLE,
            provider_subscription_id=event.subscription_id,
            plan_code=event.plan_code,
            status=event.status or "unknown",
        )
        db.add(subscription)

    subscription.astrologer_id = astrologer.id
    subscription.billing_customer_id = customer_row.id if customer_row else subscription.billing_customer_id
    subscription.plan_code = event.plan_code
    subscription.interval = event.interval
    subscription.status = event.status or subscription.status
    subscription.current_period_start = event.current_period_start
    subscription.current_period_end = event.current_period_end
    subscription.cancel_at_period_end = event.cancel_at_period_end
    subscription.access_until = event.current_period_end
    subscription.coupon_code = event.coupon_code
    subscription.raw_provider_payload = event.raw_payload.get("data") or event.raw_payload
    db.flush()
    return subscription


def process_billing_webhook(db: Session, *, provider: BillingProvider, payload: Dict[str, Any]) -> Dict[str, Any]:
    event = provider.normalize_event(db, payload)
    existing = (
        db.query(BillingEvent)
        .filter(BillingEvent.provider == provider.provider, BillingEvent.provider_event_id == event.provider_event_id)
        .first()
    )
    if existing and existing.status == "processed":
        return {"status": "duplicate", "event_id": event.provider_event_id}

    billing_event = existing or BillingEvent(
        provider=provider.provider,
        provider_event_id=event.provider_event_id,
        event_type=event.event_type,
        raw_payload=event.raw_payload,
    )
    if not existing:
        db.add(billing_event)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            return {"status": "duplicate", "event_id": event.provider_event_id}

    try:
        subscription = upsert_subscription_from_event(db, event)
        billing_event.status = "processed"
        billing_event.processed_at = utcnow()
        db.flush()
        return {
            "status": "processed",
            "event_id": event.provider_event_id,
            "subscription_id": str(subscription.id) if subscription else None,
        }
    except Exception as exc:
        billing_event.status = "failed"
        billing_event.error_message = str(exc)
        db.flush()
        raise
