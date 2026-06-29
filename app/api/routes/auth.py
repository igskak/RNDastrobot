"""Authentication endpoints for astrologers."""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    AuthContext,
    cleanup_email_verification_tokens,
    cleanup_password_reset_tokens,
    clear_session_cookie,
    create_audit_event,
    enforce_auth_rate_limit,
    get_client_ip,
    issue_session,
    require_auth,
    revoke_astrologer_sessions,
    revoke_session,
)
from app.analytics.attribution import read_attribution
from app.auth.mailer import send_email_verification_email, send_password_reset_email
from app.auth.security import (
    email_verification_cooldown_seconds,
    email_verification_ttl,
    generate_email_verification_token,
    generate_password_reset_token,
    hash_email_verification_token,
    hash_password,
    hash_password_reset_token,
    password_reset_cooldown_seconds,
    password_reset_ttl,
    utcnow,
    verify_password,
)
from app.auth.supabase import verify_supabase_token
from app.database.connection import get_db
from app.database.models import Astrologer, EmailVerificationToken, PasswordResetToken
from app.i18n.locale import normalize_locale
from app.services.billing_service import get_billing_summary, get_effective_plan_code
from app.services.entitlements_service import (
    PLAN_PRO,
    PLAN_SOLO,
    PLAN_STANDARD,
    PLAN_TRIAL,
    TRIAL_PERIOD_DAYS,
    get_entitlements,
    get_usage,
    normalize_plan_code,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized:
        raise ValueError("Invalid email")
    return normalized


def _normalize_token(value: str) -> str:
    token = value.strip()
    if len(token) < 20:
        raise ValueError("Invalid token")
    return token


def _normalize_locale_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    normalized = normalize_locale(candidate)
    if not normalized:
        raise ValueError("Invalid locale")
    return normalized


def _validate_password(value: str) -> str:
    password = value or ""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(password) > 512:
        raise ValueError("Password is too long")
    if password.strip() == "":
        raise ValueError("Password must not be blank")
    return password


def _validate_registration_password(value: str) -> str:
    password = _validate_password(value)
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError("Password must contain letters and numbers")
    return password


def _normalize_optional_name(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > 100:
        raise ValueError("Name is too long")
    return normalized


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8, max_length=512)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8, max_length=512)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    locale: Optional[str] = None
    plan_code: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_registration_password(value)

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_name(value)

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_name(value)

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_locale_value(value)

    @field_validator("plan_code")
    @classmethod
    def validate_plan_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {PLAN_TRIAL, PLAN_SOLO}:
            raise ValueError("Invalid registration plan")
        return normalized


class VerifyEmailRequest(BaseModel):
    token: str

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        return _normalize_token(value)


class ResendVerificationRequest(BaseModel):
    email: Optional[str] = None
    token: Optional[str] = None
    locale: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _normalize_email(value)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _normalize_token(value)

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_locale_value(value)


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)


class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        return _normalize_token(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)


class GoogleAuthRequest(BaseModel):
    token: Optional[str] = None
    access_token: Optional[str] = None
    id_token: Optional[str] = None


class PlanUpdateRequest(BaseModel):
    plan_code: str

    @field_validator("plan_code")
    @classmethod
    def validate_plan_code(cls, value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized not in {PLAN_TRIAL, PLAN_SOLO, PLAN_STANDARD, PLAN_PRO}:
            raise ValueError("Invalid plan")
        return normalized


class MeResponse(BaseModel):
    id: str
    email: str
    auth_provider: str
    is_active: bool
    plan_code: str
    base_plan_code: str
    plan_expires_at: Optional[str] = None
    entitlements: Dict[str, Any]
    usage: Dict[str, Any]
    billing: Dict[str, Any] = Field(default_factory=dict)


class FrontendAuthConfig(BaseModel):
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    password_reset_cooldown_seconds: int
    email_verification_cooldown_seconds: int


class GenericAuthResponse(BaseModel):
    status: str
    message: str
    cooldown_seconds: Optional[int] = None


def _get_google_token(payload: GoogleAuthRequest) -> Optional[str]:
    # Supabase OAuth flow must use Supabase access token for backend verification.
    return payload.access_token or payload.token or payload.id_token


def _forgot_password_message() -> str:
    return "If the email exists, a reset link will be sent shortly."


def _register_message() -> str:
    return "If the email can be registered, the account will be ready shortly."


def _resend_verification_message() -> str:
    return "If the account is eligible, a verification link will be sent shortly."


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _build_auth_base_url(request: Request) -> str:
    return (
        os.getenv("FRONTEND_BASE_URL", "").strip()
        or os.getenv("APP_BASE_URL", "").strip()
        or str(request.base_url).rstrip("/")
    )


def _resolve_mail_locale(request: Request, *, explicit_locale: Optional[str], astrologer: Optional[Astrologer] = None) -> str:
    for candidate in (
        explicit_locale,
        getattr(astrologer, "preferred_locale", None),
        getattr(request.state, "locale", None),
        request.headers.get("x-locale"),
        request.headers.get("accept-language"),
    ):
        normalized = normalize_locale(candidate)
        if normalized:
            return normalized
    return "en"


def _build_password_reset_link(request: Request, token: str) -> str:
    return f"{_build_auth_base_url(request)}/login.html?mode=reset&token={token}"


def _build_email_verification_link(request: Request, token: str) -> str:
    return f"{_build_auth_base_url(request)}/auth/verify?token={token}"


def _is_email_verified(astrologer: Astrologer) -> bool:
    if astrologer.auth_provider == "google":
        return True
    return astrologer.email_verified_at is not None


def _mark_email_verified(astrologer: Astrologer) -> None:
    if astrologer.email_verified_at is None:
        astrologer.email_verified_at = utcnow()


def _trial_expiry(plan_code: str) -> Optional[datetime]:
    """New trial accounts get a TRIAL_PERIOD_DAYS window, after which the account
    drops to read-only (PLAN_EXPIRED). Paid plans chosen at signup have no trial
    deadline."""
    if normalize_plan_code(plan_code) == PLAN_TRIAL:
        return utcnow() + timedelta(days=TRIAL_PERIOD_DAYS)
    return None


def _build_me_response(db: Session, astrologer: Astrologer) -> MeResponse:
    base_plan_code = normalize_plan_code(getattr(astrologer, "plan_code", None))
    effective_plan_code = get_effective_plan_code(db, astrologer)
    return MeResponse(
        id=str(astrologer.id),
        email=astrologer.email,
        auth_provider=astrologer.auth_provider,
        is_active=astrologer.is_active,
        plan_code=effective_plan_code,
        base_plan_code=base_plan_code,
        plan_expires_at=astrologer.plan_expires_at.isoformat() if astrologer.plan_expires_at else None,
        entitlements=get_entitlements(astrologer, plan_code=effective_plan_code),
        usage=get_usage(db, astrologer, plan_code=effective_plan_code),
        billing=get_billing_summary(db, astrologer),
    )


def _verification_cooldown_remaining(db: Session, astrologer: Astrologer) -> int:
    latest_token = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.astrologer_id == astrologer.id)
        .order_by(EmailVerificationToken.created_at.desc())
        .first()
    )
    if not latest_token or not latest_token.created_at:
        return 0

    cooldown = email_verification_cooldown_seconds()
    elapsed = int((utcnow() - _as_utc(latest_token.created_at)).total_seconds())
    return max(0, cooldown - elapsed)


def _create_password_reset_token(db: Session, request: Request, astrologer: Astrologer) -> str:
    now = utcnow()
    cleanup_password_reset_tokens(db, astrologer_id=astrologer.id)

    existing_tokens = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.astrologer_id == astrologer.id,
            PasswordResetToken.used_at.is_(None),
        )
        .all()
    )
    for existing in existing_tokens:
        existing.used_at = now

    raw_token = generate_password_reset_token()
    db.add(
        PasswordResetToken(
            astrologer_id=astrologer.id,
            token_hash=hash_password_reset_token(raw_token),
            expires_at=now + password_reset_ttl(),
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.flush()
    return raw_token


def _create_email_verification_token(db: Session, request: Request, astrologer: Astrologer) -> str:
    now = utcnow()
    cleanup_email_verification_tokens(db, astrologer_id=astrologer.id)

    active_tokens = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.astrologer_id == astrologer.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .all()
    )
    for existing in active_tokens:
        existing.used_at = now

    raw_token = generate_email_verification_token()
    db.add(
        EmailVerificationToken(
            astrologer_id=astrologer.id,
            token_hash=hash_email_verification_token(raw_token),
            expires_at=now + email_verification_ttl(),
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.flush()
    return raw_token


def _send_password_reset_email(request: Request, astrologer: Astrologer, token: str) -> None:
    try:
        send_password_reset_email(
            recipient=astrologer.email,
            reset_link=_build_password_reset_link(request, token),
            ttl_minutes=max(1, int(password_reset_ttl().total_seconds() // 60)),
            locale=_resolve_mail_locale(request, explicit_locale=None, astrologer=astrologer),
        )
    except Exception as exc:
        logger.warning("Password reset email delivery failed for astrologer_id=%s: %s", astrologer.id, exc)


def _send_email_verification(
    request: Request,
    astrologer: Astrologer,
    token: str,
    *,
    locale: Optional[str] = None,
) -> bool:
    try:
        return send_email_verification_email(
            recipient=astrologer.email,
            verify_link=_build_email_verification_link(request, token),
            ttl_hours=max(1, int(email_verification_ttl().total_seconds() // 3600)),
            locale=_resolve_mail_locale(request, explicit_locale=locale, astrologer=astrologer),
        )
    except Exception as exc:
        logger.warning("Verification email delivery failed for astrologer_id=%s: %s", astrologer.id, exc)
        return False


def _issue_verification_email_if_allowed(
    db: Session,
    request: Request,
    astrologer: Astrologer,
    *,
    locale: Optional[str] = None,
) -> tuple[bool, int, bool]:
    cooldown_remaining = _verification_cooldown_remaining(db, astrologer)
    if cooldown_remaining > 0:
        return False, cooldown_remaining, False

    token = _create_email_verification_token(db, request, astrologer)
    delivered = _send_email_verification(request, astrologer, token, locale=locale)
    return delivered, email_verification_cooldown_seconds(), True


def _verification_delivery_result(*, delivered: bool, cooldown: int, attempted_send: bool) -> str:
    if delivered:
        return "success"
    if not attempted_send and cooldown > 0:
        return "cooldown"
    return "failure"


def _neutral_forgot_password_response() -> GenericAuthResponse:
    return GenericAuthResponse(
        status="ok",
        message=_forgot_password_message(),
        cooldown_seconds=password_reset_cooldown_seconds(),
    )


def _neutral_register_response() -> GenericAuthResponse:
    return GenericAuthResponse(
        status="ok",
        message=_register_message(),
        cooldown_seconds=email_verification_cooldown_seconds(),
    )


def _neutral_resend_verification_response() -> GenericAuthResponse:
    return GenericAuthResponse(
        status="ok",
        message=_resend_verification_message(),
        cooldown_seconds=email_verification_cooldown_seconds(),
    )


@router.get("/frontend-config", response_model=FrontendAuthConfig)
def get_frontend_auth_config():
    return FrontendAuthConfig(
        supabase_url=os.getenv("SUPABASE_URL") or None,
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY") or None,
        password_reset_cooldown_seconds=password_reset_cooldown_seconds(),
        email_verification_cooldown_seconds=email_verification_cooldown_seconds(),
    )


@router.post("/register", response_model=GenericAuthResponse)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()
    enforce_auth_rate_limit(db, request, action="auth.register", email=email)

    astrologer = db.query(Astrologer).filter(Astrologer.email == email).first()
    if astrologer is not None:
        create_audit_event(
            db,
            request,
            actor_id=astrologer.id,
            action="auth.register",
            resource_type="astrologer",
            resource_id=email,
            result="failure",
        )
        return _neutral_register_response()

    astrologer = Astrologer(
        email=email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        preferred_locale=payload.locale,
        password_hash=hash_password(payload.password),
        auth_provider="local",
        is_active=True,
        email_verified_at=utcnow(),
        plan_code=payload.plan_code or PLAN_TRIAL,
        plan_expires_at=_trial_expiry(payload.plan_code or PLAN_TRIAL),
    )
    db.add(astrologer)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.query(Astrologer).filter(Astrologer.email == email).first()
        if existing is not None:
            create_audit_event(
                db,
                request,
                actor_id=existing.id,
                action="auth.register",
                resource_type="astrologer",
                resource_id=email,
                result="failure",
            )
            return _neutral_register_response()
        raise

    create_audit_event(
        db,
        request,
        actor_id=astrologer.id,
        action="auth.register",
        resource_type="astrologer",
        resource_id=email,
        result="success",
        properties=read_attribution(request),
    )
    return _neutral_register_response()


@router.post("/verify-email", response_model=GenericAuthResponse)
def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_auth_rate_limit(db, request, action="auth.verify-email")

    token_hash = hash_email_verification_token(payload.token)
    verification_token = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_hash)
        .first()
    )
    if not verification_token:
        create_audit_event(
            db,
            request,
            actor_id=None,
            action="auth.verification.verify",
            resource_type="email_verification_token",
            resource_id=None,
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verification link is invalid")

    if verification_token.used_at is not None:
        create_audit_event(
            db,
            request,
            actor_id=verification_token.astrologer_id,
            action="auth.verification.verify",
            resource_type="email_verification_token",
            resource_id=str(verification_token.id),
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verification link has already been used")

    if _as_utc(verification_token.expires_at) <= utcnow():
        create_audit_event(
            db,
            request,
            actor_id=verification_token.astrologer_id,
            action="auth.verification.verify",
            resource_type="email_verification_token",
            resource_id=str(verification_token.id),
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verification link has expired")

    astrologer = db.query(Astrologer).filter(Astrologer.id == verification_token.astrologer_id).first()
    if not astrologer or not astrologer.is_active:
        create_audit_event(
            db,
            request,
            actor_id=verification_token.astrologer_id,
            action="auth.verification.verify",
            resource_type="astrologer",
            resource_id=str(verification_token.astrologer_id),
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    now = utcnow()
    verification_token.used_at = now
    other_active_tokens = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.astrologer_id == astrologer.id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.id != verification_token.id,
        )
        .all()
    )
    for other in other_active_tokens:
        other.used_at = now

    _mark_email_verified(astrologer)
    create_audit_event(
        db,
        request,
        actor_id=astrologer.id,
        action="auth.verification.verify",
        resource_type="astrologer",
        resource_id=astrologer.email,
        result="success",
    )
    return GenericAuthResponse(
        status="ok",
        message="Email verified successfully",
    )


@router.post("/resend-verification", response_model=GenericAuthResponse)
def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    if not payload.email and not payload.token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or token is required")

    lookup_email = payload.email.lower().strip() if payload.email else None
    enforce_auth_rate_limit(db, request, action="auth.resend-verification", email=lookup_email)
    cleanup_email_verification_tokens(db)

    astrologer: Optional[Astrologer] = None
    if payload.email:
        astrologer = db.query(Astrologer).filter(Astrologer.email == lookup_email).first()
    elif payload.token:
        token_hash = hash_email_verification_token(payload.token)
        token_record = db.query(EmailVerificationToken).filter(EmailVerificationToken.token_hash == token_hash).first()
        if token_record:
            astrologer = db.query(Astrologer).filter(Astrologer.id == token_record.astrologer_id).first()

    create_audit_event(
        db,
        request,
        actor_id=astrologer.id if astrologer else None,
        action="auth.resend-verification",
        resource_type="astrologer",
        resource_id=lookup_email,
        result="requested",
    )

    if astrologer and astrologer.auth_provider == "local" and astrologer.is_active and not _is_email_verified(astrologer):
        if payload.locale:
            astrologer.preferred_locale = payload.locale
        delivered, cooldown, attempted_send = _issue_verification_email_if_allowed(
            db, request, astrologer, locale=payload.locale
        )
        create_audit_event(
            db,
            request,
            actor_id=astrologer.id,
            action="auth.verification.sent",
            resource_type="astrologer",
            resource_id=astrologer.email,
            result=_verification_delivery_result(
                delivered=delivered,
                cooldown=cooldown,
                attempted_send=attempted_send,
            ),
        )

    return _neutral_resend_verification_response()


@router.post("/login", response_model=MeResponse)
def login(
    request_payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email = request_payload.email.lower().strip()
    enforce_auth_rate_limit(db, request, action="auth.login", email=email)

    astrologer = db.query(Astrologer).filter(Astrologer.email == email).first()
    if not astrologer or not astrologer.password_hash or not verify_password(request_payload.password, astrologer.password_hash):
        create_audit_event(
            db,
            request,
            actor_id=astrologer.id if astrologer else None,
            action="auth.login",
            resource_type="astrologer",
            resource_id=email,
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not astrologer.is_active:
        create_audit_event(
            db,
            request,
            actor_id=astrologer.id,
            action="auth.login",
            resource_type="astrologer",
            resource_id=email,
            result="inactive",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    if astrologer.auth_provider == "local" and astrologer.email_verified_at is None:
        _mark_email_verified(astrologer)

    issue_session(response, db, request, astrologer)
    create_audit_event(
        db,
        request,
        actor_id=astrologer.id,
        action="auth.login",
        resource_type="astrologer",
        resource_id=email,
        result="success",
    )
    return _build_me_response(db, astrologer)


@router.post("/forgot-password", response_model=GenericAuthResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()
    enforce_auth_rate_limit(db, request, action="auth.forgot-password", email=email)
    cleanup_password_reset_tokens(db)

    astrologer = db.query(Astrologer).filter(Astrologer.email == email).first()
    create_audit_event(
        db,
        request,
        actor_id=astrologer.id if astrologer else None,
        action="auth.forgot-password",
        resource_type="astrologer",
        resource_id=email,
        result="requested",
    )

    if astrologer and astrologer.is_active:
        token = _create_password_reset_token(db, request, astrologer)
        _send_password_reset_email(request, astrologer, token)

    return _neutral_forgot_password_response()


@router.post("/resend-reset-link", response_model=GenericAuthResponse)
def resend_reset_link(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    return forgot_password(payload, request, db)


@router.post("/reset-password", response_model=GenericAuthResponse)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_auth_rate_limit(db, request, action="auth.reset-password")

    token_hash = hash_password_reset_token(payload.token)
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    if not reset_token:
        create_audit_event(
            db,
            request,
            actor_id=None,
            action="auth.reset-password",
            resource_type="password_reset_token",
            resource_id=None,
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Reset link is invalid")

    if reset_token.used_at is not None:
        create_audit_event(
            db,
            request,
            actor_id=reset_token.astrologer_id,
            action="auth.reset-password",
            resource_type="password_reset_token",
            resource_id=str(reset_token.id),
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Reset link has already been used")

    if _as_utc(reset_token.expires_at) <= utcnow():
        create_audit_event(
            db,
            request,
            actor_id=reset_token.astrologer_id,
            action="auth.reset-password",
            resource_type="password_reset_token",
            resource_id=str(reset_token.id),
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Reset link has expired")

    astrologer = db.query(Astrologer).filter(Astrologer.id == reset_token.astrologer_id).first()
    if not astrologer or not astrologer.is_active:
        create_audit_event(
            db,
            request,
            actor_id=reset_token.astrologer_id,
            action="auth.reset-password",
            resource_type="astrologer",
            resource_id=str(reset_token.astrologer_id),
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    astrologer.password_hash = hash_password(payload.password)
    reset_token.used_at = utcnow()
    revoke_astrologer_sessions(db, astrologer.id)
    cleanup_password_reset_tokens(db, astrologer_id=astrologer.id)
    clear_session_cookie(response)

    create_audit_event(
        db,
        request,
        actor_id=astrologer.id,
        action="auth.reset-password",
        resource_type="astrologer",
        resource_id=astrologer.email,
        result="success",
    )
    return GenericAuthResponse(
        status="ok",
        message="Password updated successfully",
    )


@router.post("/google", response_model=MeResponse)
def google_login(
    request_payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = _get_google_token(request_payload)
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token is required")

    # Email is unknown until token verification; apply IP-only limiter first.
    enforce_auth_rate_limit(db, request, action="auth.google")

    try:
        identity = verify_supabase_token(token)
    except ValueError as exc:
        create_audit_event(
            db,
            request,
            actor_id=None,
            action="auth.google",
            resource_type="astrologer",
            resource_id=None,
            result="failure",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    enforce_auth_rate_limit(db, request, action="auth.google", email=identity.email)

    if identity.provider and identity.provider != "google":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OAuth provider is not Google")

    astrologer = (
        db.query(Astrologer)
        .filter(or_(Astrologer.google_sub == identity.sub, Astrologer.email == identity.email))
        .first()
    )

    if astrologer is None:
        astrologer = Astrologer(
            email=identity.email,
            password_hash=None,
            auth_provider="google",
            google_sub=identity.sub,
            is_active=True,
            email_verified_at=utcnow(),
            plan_code=PLAN_TRIAL,
            plan_expires_at=_trial_expiry(PLAN_TRIAL),
        )
        db.add(astrologer)
        db.flush()
    else:
        if astrologer.google_sub is None:
            astrologer.google_sub = identity.sub
        astrologer.auth_provider = "google"
        astrologer.email = identity.email
        _mark_email_verified(astrologer)
        db.flush()

    if not astrologer.is_active:
        create_audit_event(
            db,
            request,
            actor_id=astrologer.id,
            action="auth.google",
            resource_type="astrologer",
            resource_id=identity.email,
            result="inactive",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    issue_session(response, db, request, astrologer)
    create_audit_event(
        db,
        request,
        actor_id=astrologer.id,
        action="auth.google",
        resource_type="astrologer",
        resource_id=identity.email,
        result="success",
    )
    return _build_me_response(db, astrologer)


@router.get("/me", response_model=MeResponse)
def me(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    astrologer = auth.astrologer
    return _build_me_response(db, astrologer)


@router.patch("/me/plan", response_model=MeResponse)
def update_me_plan(
    payload: PlanUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    astrologer = auth.astrologer
    old_plan = normalize_plan_code(getattr(astrologer, "plan_code", None))
    astrologer.plan_code = payload.plan_code
    astrologer.plan_assigned_at = utcnow()
    astrologer.plan_expires_at = None
    create_audit_event(
        db,
        request,
        actor_id=astrologer.id,
        action="auth.plan.update",
        resource_type="astrologer",
        resource_id=astrologer.email,
        result=f"{old_plan}->{payload.plan_code}",
    )
    db.flush()
    return _build_me_response(db, astrologer)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    sid = request.cookies.get("astrobot_session")
    revoke_session(db, sid)
    clear_session_cookie(response)
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="auth.logout",
        resource_type="session",
        resource_id=sid,
        result="success",
    )
    return {"status": "ok"}


@router.post("/bootstrap")
def create_initial_astrologer(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Dev-only helper to create first local astrologer."""
    enabled = os.getenv("ENABLE_DEV_BOOTSTRAP", "").strip().lower() in {"1", "true", "yes", "on"}
    if not enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bootstrap is disabled")

    client_ip = request.client.host if request.client else ""
    if client_ip not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bootstrap allowed only from localhost")

    if os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Disabled in production")

    email = payload.email.lower().strip()
    exists = db.query(Astrologer).filter(Astrologer.email == email).first()
    if exists:
        return {"status": "ok", "email": exists.email}

    astrologer = Astrologer(
        email=email,
        password_hash=hash_password(payload.password),
        auth_provider="local",
        is_active=True,
        email_verified_at=utcnow(),
    )
    db.add(astrologer)
    db.flush()
    return {"status": "ok", "email": astrologer.email, "id": str(astrologer.id)}
