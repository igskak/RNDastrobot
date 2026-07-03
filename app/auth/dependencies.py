"""Authentication dependencies and helpers."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import os
from threading import RLock
from time import monotonic
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.security import (
    SESSION_COOKIE_NAME,
    cookie_domain,
    cookie_secure,
    generate_session_id,
    session_ttl,
    utcnow,
)
from app.database.connection import get_db
from app.database.models import Astrologer, AuthSession, AuditEvent, EmailVerificationToken, PasswordResetToken, User
from app.services.billing_service import get_effective_plan_code


RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_PER_IP = 25
LOCKOUT_WINDOW_MINUTES = 15
LOCKOUT_MAX_FAILURES = 5
READ_AUDIT_ROLLUP_SECONDS = int(os.getenv("AUDIT_READ_ROLLUP_SECONDS", "300") or "0")
READ_AUDIT_ROLLUP_ACTIONS = {
    "client.forecast_aux",
    "client.profections",
    "client.antiscia",
    "client.asteroids",
    "client.dominants",
    "client.fixed_stars",
    "client.transits.calculate",
    "client.progressions.calculate",
    "client.directions.calculate",
    "preferences.account.get",
    "preferences.resolved.get",
}
_read_audit_rollup: dict[tuple[str, str, str, str], float] = {}
_read_audit_rollup_lock = RLock()


@dataclass
class AuthContext:
    astrologer: Astrologer
    session: AuthSession
    effective_plan_code: Optional[str] = None
    base_plan_code: Optional[str] = None

    def __post_init__(self) -> None:
        if self.base_plan_code is None:
            self.base_plan_code = getattr(self.astrologer, "plan_code", None)
        if self.effective_plan_code is None:
            self.effective_plan_code = self.base_plan_code


def get_client_ip(request: Request) -> Optional[str]:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip() or None
    return request.client.host if request.client else None


def _request_host(request: Request) -> str:
    host = request.headers.get("host") or request.url.hostname or ""
    if host.startswith("["):
        return host.split("]", 1)[0].strip("[]").lower()
    return host.split(":", 1)[0].strip().rstrip(".").lower()


def _cookie_domain_for_request(request: Request) -> Optional[str]:
    configured = cookie_domain()
    if not configured:
        return None

    host = _request_host(request)
    domain = configured.strip().lstrip(".").rstrip(".").lower()
    if not host or host in {"localhost", "127.0.0.1", "::1"}:
        return None
    if host == domain or host.endswith(f".{domain}"):
        return configured
    return None


def create_audit_event(
    db: Session,
    request: Request,
    *,
    actor_id: Optional[UUID],
    action: str,
    resource_type: str,
    resource_id: Optional[str],
    result: str,
    properties: Optional[dict] = None,
    session_id: Optional[str] = None,
) -> None:
    # The session cookie value *is* the server-side session id; derive it so
    # every authenticated event is correlated without touching call sites.
    if session_id is None:
        session_id = request.cookies.get(SESSION_COOKIE_NAME)

    if _should_rollup_read_audit(
        actor_id=actor_id,
        action=action,
        resource_id=resource_id,
        result=result,
    ):
        return

    try:
        db.add(
            AuditEvent(
                actor_id=actor_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                result=result,
                ip=get_client_ip(request),
                user_agent=request.headers.get("user-agent"),
                properties=properties,
                session_id=session_id,
            )
        )
        db.flush()
    except Exception:
        # Audit must not break business flow.
        pass

    # Best-effort mirror of value events to PostHog (no-op without a key or for
    # non-allowlisted actions). Imported lazily to avoid import-time coupling.
    try:
        from app.analytics.posthog import mirror_audit_event

        mirror_audit_event(
            actor_id=actor_id,
            action=action,
            result=result,
            resource_type=resource_type,
            resource_id=resource_id,
            session_id=session_id,
            properties=properties,
        )
    except Exception:
        # Analytics must never break business flow.
        pass


def _should_rollup_read_audit(
    *,
    actor_id: Optional[UUID],
    action: str,
    resource_id: Optional[str],
    result: str,
) -> bool:
    if READ_AUDIT_ROLLUP_SECONDS <= 0:
        return False
    if result != "success" or action not in READ_AUDIT_ROLLUP_ACTIONS:
        return False
    now = monotonic()
    key = (str(actor_id or ""), action, str(resource_id or ""), result)
    with _read_audit_rollup_lock:
        expires_at = _read_audit_rollup.get(key)
        if expires_at and expires_at > now:
            return True
        _read_audit_rollup[key] = now + READ_AUDIT_ROLLUP_SECONDS
        if len(_read_audit_rollup) > 4096:
            expired = [
                item_key
                for item_key, item_expires_at in _read_audit_rollup.items()
                if item_expires_at <= now
            ]
            for item_key in expired[:1024]:
                _read_audit_rollup.pop(item_key, None)
    return False


def _rate_limit_count(db: Session, *, ip: Optional[str], action_prefix: str, window_seconds: int) -> int:
    if not ip:
        return 0
    since = utcnow() - timedelta(seconds=window_seconds)
    return (
        db.query(func.count(AuditEvent.id))
        .filter(
            AuditEvent.ip == ip,
            AuditEvent.action.like(f"{action_prefix}%"),
            AuditEvent.created_at >= since,
        )
        .scalar()
        or 0
    )


def _failed_auth_count(db: Session, *, ip: Optional[str], email: Optional[str], action: str) -> int:
    since = utcnow() - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
    query = (
        db.query(func.count(AuditEvent.id))
        .filter(
            AuditEvent.action == action,
            AuditEvent.result == "failure",
            AuditEvent.created_at >= since,
        )
    )
    if ip and email:
        query = query.filter(or_(AuditEvent.ip == ip, AuditEvent.resource_id == email))
    elif ip:
        query = query.filter(AuditEvent.ip == ip)
    elif email:
        query = query.filter(AuditEvent.resource_id == email)
    return query.scalar() or 0


def enforce_auth_rate_limit(db: Session, request: Request, *, action: str, email: Optional[str] = None) -> None:
    ip = get_client_ip(request)
    ip_events = _rate_limit_count(db, ip=ip, action_prefix="auth.", window_seconds=RATE_LIMIT_WINDOW_SECONDS)
    if ip_events >= RATE_LIMIT_MAX_PER_IP:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many authentication attempts")

    failed = _failed_auth_count(db, ip=ip, email=email, action=action)
    if failed >= LOCKOUT_MAX_FAILURES:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Account temporarily locked")


def issue_session(response: Response, db: Session, request: Request, astrologer: Astrologer) -> AuthSession:
    sid = generate_session_id()
    now = utcnow()
    session = AuthSession(
        session_id=sid,
        astrologer_id=astrologer.id,
        expires_at=now + session_ttl(),
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    db.add(session)
    db.flush()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sid,
        httponly=True,
        secure=cookie_secure(),
        samesite="lax",
        domain=_cookie_domain_for_request(request),
        max_age=int(session_ttl().total_seconds()),
        path="/",
    )
    return session


def _delete_session_cookie(response: Response, domain: Optional[str]) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=cookie_secure(),
        samesite="lax",
        domain=domain,
        path="/",
    )


def clear_session_cookie(response: Response, request: Optional[Request] = None) -> None:
    valid_domain = _cookie_domain_for_request(request) if request is not None else cookie_domain()
    configured_domain = cookie_domain()
    domains: list[Optional[str]] = [valid_domain]
    if configured_domain and configured_domain != valid_domain:
        domains.append(configured_domain)
    if valid_domain is not None:
        domains.append(None)

    seen: set[Optional[str]] = set()
    for domain in domains:
        if domain in seen:
            continue
        seen.add(domain)
        _delete_session_cookie(response, domain)


def require_auth(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    sid = request.cookies.get(SESSION_COOKIE_NAME)
    if not sid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    now = utcnow()
    session = (
        db.query(AuthSession)
        .filter(
            AuthSession.session_id == sid,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")

    astrologer = (
        db.query(Astrologer)
        .filter(Astrologer.id == session.astrologer_id, Astrologer.is_active.is_(True))
        .first()
    )
    if not astrologer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Astrologer account is inactive")

    return AuthContext(
        astrologer=astrologer,
        session=session,
        base_plan_code=getattr(astrologer, "plan_code", None),
        effective_plan_code=get_effective_plan_code(db, astrologer),
    )


def ensure_client_access(
    db: Session,
    request: Request,
    auth: AuthContext,
    user_id: UUID,
    *,
    action: str,
    resource_type: str = "user",
    allow_missing: bool = False,
) -> User:
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action=action,
            resource_type=resource_type,
            resource_id=str(user_id),
            result="not_found",
        )
        if allow_missing:
            return None
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    if user.astrologer_id != auth.astrologer.id:
        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action=action,
            resource_type=resource_type,
            resource_id=str(user_id),
            result="forbidden",
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action=action,
        resource_type=resource_type,
        resource_id=str(user_id),
        result="success",
    )
    return user


def revoke_session(db: Session, sid: str) -> None:
    if not sid:
        return
    session = db.query(AuthSession).filter(AuthSession.session_id == sid, AuthSession.revoked_at.is_(None)).first()
    if session:
        session.revoked_at = utcnow()
        db.flush()


def revoke_astrologer_sessions(
    db: Session,
    astrologer_id: UUID,
    *,
    except_session_id: Optional[str] = None,
) -> int:
    if not astrologer_id:
        return 0

    query = db.query(AuthSession).filter(
        AuthSession.astrologer_id == astrologer_id,
        AuthSession.revoked_at.is_(None),
    )
    if except_session_id:
        query = query.filter(AuthSession.session_id != except_session_id)

    sessions = query.all()
    if not sessions:
        return 0

    now = utcnow()
    for session in sessions:
        session.revoked_at = now
    db.flush()
    return len(sessions)


def cleanup_password_reset_tokens(db: Session, *, astrologer_id: Optional[UUID] = None) -> int:
    now = utcnow()
    query = db.query(PasswordResetToken).filter(
        or_(
            PasswordResetToken.expires_at < now,
            PasswordResetToken.used_at < now - timedelta(days=1),
        )
    )
    if astrologer_id:
        query = query.filter(PasswordResetToken.astrologer_id == astrologer_id)

    tokens = query.all()
    if not tokens:
        return 0

    deleted = len(tokens)
    for token in tokens:
        db.delete(token)
    db.flush()
    return deleted


def cleanup_email_verification_tokens(db: Session, *, astrologer_id: Optional[UUID] = None) -> int:
    now = utcnow()
    query = db.query(EmailVerificationToken).filter(
        or_(
            EmailVerificationToken.expires_at < now,
            EmailVerificationToken.used_at < now - timedelta(days=1),
        )
    )
    if astrologer_id:
        query = query.filter(EmailVerificationToken.astrologer_id == astrologer_id)

    tokens = query.all()
    if not tokens:
        return 0

    deleted = len(tokens)
    for token in tokens:
        db.delete(token)
    db.flush()
    return deleted


def require_client_access(client_id_param: str = "user_id", action: str = "client.access"):
    """Dependency factory for ownership checks by path parameter name."""

    def _dependency(
        request: Request,
        db: Session = Depends(get_db),
        auth: AuthContext = Depends(require_auth),
    ) -> User:
        raw_id = request.path_params.get(client_id_param)
        if not raw_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing client id")
        try:
            user_id = UUID(str(raw_id))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid client id") from exc
        return ensure_client_access(db, request, auth, user_id, action=action)

    return _dependency
