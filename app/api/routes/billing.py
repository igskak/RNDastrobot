"""Billing API and provider webhook endpoints."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.services.billing_service import (
    BILLING_PROVIDER_PADDLE,
    BILLING_PROVIDER_STRIPE,
    PAID_PLAN_CODES,
    SUPPORTED_INTERVALS,
    get_billing_provider,
    get_billing_summary,
    process_billing_webhook,
)


router = APIRouter(tags=["Billing"])


class CheckoutRequest(BaseModel):
    plan_code: str
    interval: str = Field(default="monthly")
    coupon_code: Optional[str] = None

    @field_validator("plan_code")
    @classmethod
    def validate_plan_code(cls, value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized not in PAID_PLAN_CODES:
            raise ValueError("Invalid paid plan")
        return normalized

    @field_validator("interval")
    @classmethod
    def validate_interval(cls, value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized not in SUPPORTED_INTERVALS:
            raise ValueError("Invalid billing interval")
        return normalized

    @field_validator("coupon_code")
    @classmethod
    def validate_coupon_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized[:100] or None


class CheckoutResponse(BaseModel):
    checkout_url: str
    provider: str


class PortalResponse(BaseModel):
    portal_url: str
    provider: str


class BillingSubscriptionResponse(BaseModel):
    provider: str
    subscription: Optional[Dict[str, Any]] = None


@router.post("/billing/checkout", response_model=CheckoutResponse)
def create_checkout(
    payload: CheckoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    provider = get_billing_provider()
    checkout = provider.create_checkout(
        db,
        astrologer=auth.astrologer,
        plan_code=payload.plan_code,
        interval=payload.interval,
        coupon_code=payload.coupon_code,
    )
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="billing.checkout.create",
        resource_type="billing_checkout",
        resource_id=payload.plan_code,
        result="success",
    )
    return CheckoutResponse(checkout_url=checkout.checkout_url, provider=checkout.provider)


@router.get("/billing/portal", response_model=PortalResponse)
def create_customer_portal(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    provider = get_billing_provider()
    portal = provider.create_customer_portal(db, astrologer=auth.astrologer)
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="billing.portal.create",
        resource_type="billing_portal",
        resource_id=auth.astrologer.email,
        result="success",
    )
    return PortalResponse(portal_url=portal.portal_url, provider=portal.provider)


@router.get("/billing/subscription", response_model=BillingSubscriptionResponse)
def get_subscription(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    return BillingSubscriptionResponse(**get_billing_summary(db, auth.astrologer))


async def _handle_billing_webhook(request: Request, db: Session, expected_provider: str) -> Dict[str, Any]:
    provider = get_billing_provider()
    if provider.provider != expected_provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing provider is not enabled.")

    raw_body = await request.body()
    payload = provider.verify_webhook(raw_body, dict(request.headers))
    return process_billing_webhook(db, provider=provider, payload=payload)


@router.post("/webhooks/billing/stripe", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    return await _handle_billing_webhook(request, db, BILLING_PROVIDER_STRIPE)


@router.post("/webhooks/billing/paddle", include_in_schema=False)
async def paddle_webhook(request: Request, db: Session = Depends(get_db)):
    return await _handle_billing_webhook(request, db, BILLING_PROVIDER_PADDLE)
