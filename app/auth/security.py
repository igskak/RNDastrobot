"""Security helpers for authentication."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional


SESSION_COOKIE_NAME = "astrobot_session"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def session_ttl() -> timedelta:
    raw = os.getenv("SESSION_TTL_HOURS", "168").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 168
    return timedelta(hours=max(1, hours))


def generate_session_id() -> str:
    return secrets.token_urlsafe(48)


def cookie_secure() -> bool:
    raw = os.getenv("COOKIE_SECURE", "").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return os.getenv("APP_ENV", "development").lower() == "production"


def cookie_domain() -> Optional[str]:
    value = os.getenv("COOKIE_DOMAIN", "").strip()
    return value or None


def get_password_hasher():
    try:
        from argon2 import PasswordHasher

        return ("argon2", PasswordHasher())
    except Exception:
        try:
            import bcrypt

            return ("bcrypt", bcrypt)
        except Exception:
            return (None, None)


def hash_password(password: str) -> str:
    algo, handler = get_password_hasher()
    if algo == "argon2":
        return handler.hash(password)
    if algo == "bcrypt":
        return handler.hashpw(password.encode("utf-8"), handler.gensalt()).decode("utf-8")
    raise RuntimeError("No password hashing backend available. Install argon2-cffi or bcrypt.")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False

    algo, handler = get_password_hasher()
    try:
        if algo == "argon2":
            return bool(handler.verify(password_hash, password))
        if algo == "bcrypt":
            return bool(handler.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")))
    except Exception:
        return False

    return False
