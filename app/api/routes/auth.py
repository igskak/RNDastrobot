"""Authentication endpoints for astrologers."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    AuthContext,
    clear_session_cookie,
    create_audit_event,
    enforce_auth_rate_limit,
    issue_session,
    require_auth,
    revoke_session,
)
from app.auth.security import hash_password, verify_password
from app.auth.supabase import verify_supabase_token
from app.database.connection import get_db
from app.database.models import Astrologer

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8, max_length=512)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Invalid email")
        return normalized


class GoogleAuthRequest(BaseModel):
    token: Optional[str] = None
    access_token: Optional[str] = None
    id_token: Optional[str] = None


class MeResponse(BaseModel):
    id: str
    email: str
    auth_provider: str
    is_active: bool


class FrontendAuthConfig(BaseModel):
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None


def _get_google_token(payload: GoogleAuthRequest) -> Optional[str]:
    # Supabase OAuth flow must use Supabase access token for backend verification.
    return payload.access_token or payload.token or payload.id_token


@router.get("/frontend-config", response_model=FrontendAuthConfig)
def get_frontend_auth_config():
    return FrontendAuthConfig(
        supabase_url=os.getenv("SUPABASE_URL") or None,
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY") or None,
    )


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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

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
    return MeResponse(
        id=str(astrologer.id),
        email=astrologer.email,
        auth_provider=astrologer.auth_provider,
        is_active=astrologer.is_active,
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
        )
        db.add(astrologer)
        db.flush()
    else:
        if astrologer.google_sub is None:
            astrologer.google_sub = identity.sub
        astrologer.auth_provider = "google"
        astrologer.email = identity.email
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
    return MeResponse(
        id=str(astrologer.id),
        email=astrologer.email,
        auth_provider=astrologer.auth_provider,
        is_active=astrologer.is_active,
    )


@router.get("/me", response_model=MeResponse)
def me(auth: AuthContext = Depends(require_auth)):
    astrologer = auth.astrologer
    return MeResponse(
        id=str(astrologer.id),
        email=astrologer.email,
        auth_provider=astrologer.auth_provider,
        is_active=astrologer.is_active,
    )


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
    )
    db.add(astrologer)
    db.flush()
    return {"status": "ok", "email": astrologer.email, "id": str(astrologer.id)}
