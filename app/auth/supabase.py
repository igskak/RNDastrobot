"""Supabase JWT verification helpers."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, Optional

import httpx
import jwt
from jwt import InvalidTokenError


@dataclass
class SupabaseIdentity:
    sub: str
    email: str
    provider: Optional[str]
    claims: Dict[str, Any]


def _normalize_supabase_url(raw_url: str) -> str:
    return raw_url.rstrip("/")


def _expected_issuer() -> str:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    if not supabase_url:
        raise ValueError("SUPABASE_URL is not configured")
    return f"{_normalize_supabase_url(supabase_url)}/auth/v1"


def _expected_audience() -> Optional[str]:
    value = os.getenv("SUPABASE_JWT_AUDIENCE", "").strip()
    return value or None


def _supabase_url() -> str:
    value = os.getenv("SUPABASE_URL", "").strip()
    if not value:
        raise ValueError("SUPABASE_URL is not configured")
    return _normalize_supabase_url(value)


def _supabase_anon_key() -> Optional[str]:
    value = os.getenv("SUPABASE_ANON_KEY", "").strip()
    return value or None


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    issuer = _expected_issuer()
    return jwt.PyJWKClient(f"{issuer}/.well-known/jwks.json")


def verify_supabase_token(token: str) -> SupabaseIdentity:
    if not token:
        raise ValueError("Missing token")

    issuer = _expected_issuer()
    audience = _expected_audience()

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=audience if audience else None,
            options={"verify_aud": bool(audience)},
        )
    except Exception:
        # Some Supabase projects expose no JWKS keys (legacy symmetric signing).
        # Fallback to server-side token introspection via Supabase Auth API.
        return _verify_token_via_supabase_userinfo(token)

    sub = claims.get("sub")
    email = claims.get("email")
    if not sub or not email:
        raise ValueError("Supabase token must contain sub and email claims")

    app_meta = claims.get("app_metadata") or {}
    provider = app_meta.get("provider")

    return SupabaseIdentity(sub=str(sub), email=str(email).lower().strip(), provider=provider, claims=claims)


def _verify_token_via_supabase_userinfo(token: str) -> SupabaseIdentity:
    supabase_url = _supabase_url()
    headers = {"Authorization": f"Bearer {token}"}
    anon_key = _supabase_anon_key()
    if anon_key:
        headers["apikey"] = anon_key

    try:
        response = httpx.get(f"{supabase_url}/auth/v1/user", headers=headers, timeout=10.0)
    except Exception as exc:
        raise ValueError(f"Invalid Supabase token: {exc}") from exc

    if response.status_code != 200:
        detail = response.text.strip() or f"status {response.status_code}"
        raise ValueError(f"Invalid Supabase token: {detail}")

    data = response.json()
    sub = data.get("id")
    email = data.get("email")
    if not sub or not email:
        raise ValueError("Supabase token must contain sub and email claims")

    app_meta = data.get("app_metadata") or {}
    provider = app_meta.get("provider")

    claims = {
        "sub": sub,
        "email": email,
        "app_metadata": app_meta,
    }
    return SupabaseIdentity(sub=str(sub), email=str(email).lower().strip(), provider=provider, claims=claims)
