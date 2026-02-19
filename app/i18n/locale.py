"""Locale resolution helpers for API requests."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Optional, Tuple
from uuid import UUID

from fastapi import Request


SUPPORTED_LOCALES: Tuple[str, ...] = ("en", "uk", "ru")
DEFAULT_LOCALE = "en"


@dataclass(frozen=True)
class ResolvedLocale:
    locale: str
    source: str


def normalize_locale(raw: Optional[str]) -> Optional[str]:
    """Normalize locale (en-US -> en), return None for unsupported values."""
    if not raw:
        return None

    candidate = raw.strip().lower().replace("_", "-")
    if not candidate:
        return None

    parts = candidate.split("-", 1)
    base = parts[0]
    if base in SUPPORTED_LOCALES:
        return base

    return None


def parse_accept_language(header_value: Optional[str]) -> Optional[str]:
    """Parse Accept-Language header and return first supported locale by q-value."""
    if not header_value:
        return None

    weighted: list[tuple[float, int, str]] = []

    for idx, chunk in enumerate(header_value.split(",")):
        item = chunk.strip()
        if not item:
            continue

        lang_part = item
        quality = 1.0

        if ";" in item:
            lang_part, *params = [p.strip() for p in item.split(";")]
            for param in params:
                if not param.lower().startswith("q="):
                    continue
                try:
                    quality = float(param.split("=", 1)[1])
                except (TypeError, ValueError):
                    quality = 0.0

        normalized = normalize_locale(lang_part)
        if normalized:
            weighted.append((quality, idx, normalized))

    if not weighted:
        return None

    weighted.sort(key=lambda item: (-item[0], item[1]))
    return weighted[0][2]


def resolve_explicit_locale(request: Request) -> Optional[str]:
    """Resolve locale explicitly requested via query params or dedicated headers."""
    for key in ("locale", "lang"):
        value = request.query_params.get(key)
        normalized = normalize_locale(value)
        if normalized:
            return normalized

    for key in ("x-locale", "x-lang", "locale", "content-language"):
        value = request.headers.get(key)
        normalized = normalize_locale(value)
        if normalized:
            return normalized

    return None


def resolve_locale(
    *,
    user_preference_locale: Optional[str] = None,
    explicit_locale: Optional[str] = None,
    accept_language: Optional[str] = None,
) -> ResolvedLocale:
    """Resolve locale according to ADR-002 priority chain."""
    normalized_user_pref = normalize_locale(user_preference_locale)
    if normalized_user_pref:
        return ResolvedLocale(locale=normalized_user_pref, source="user_preference")

    normalized_explicit = normalize_locale(explicit_locale)
    if normalized_explicit:
        return ResolvedLocale(locale=normalized_explicit, source="explicit_request")

    normalized_accept = parse_accept_language(accept_language)
    if normalized_accept:
        return ResolvedLocale(locale=normalized_accept, source="accept_language")

    return ResolvedLocale(locale=DEFAULT_LOCALE, source="default")


def _normalize_user_id(candidate: Optional[str]) -> Optional[UUID]:
    if not candidate:
        return None

    normalized = candidate.strip()
    if normalized.startswith("user_"):
        normalized = normalized[5:]

    try:
        return UUID(normalized)
    except (TypeError, ValueError):
        return None


async def extract_user_id_from_request(request: Request) -> Optional[UUID]:
    """Best-effort user_id extraction from path, query, headers, and JSON body."""
    path_user_id = _normalize_user_id(request.path_params.get("user_id"))
    if path_user_id:
        return path_user_id

    query_user_id = _normalize_user_id(request.query_params.get("user_id"))
    if query_user_id:
        return query_user_id

    header_user_id = _normalize_user_id(request.headers.get("x-user-id"))
    if header_user_id:
        return header_user_id

    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" not in content_type:
        return None

    try:
        body_bytes = await request.body()
    except Exception:
        return None

    if not body_bytes:
        return None

    try:
        payload = json.loads(body_bytes)
    except (TypeError, ValueError):
        return None

    if not isinstance(payload, dict):
        return None

    return _normalize_user_id(payload.get("user_id"))
