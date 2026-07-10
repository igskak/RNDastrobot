"""Resolve the public product channel from an explicit hostname allowlist."""
from __future__ import annotations

import os
from urllib.parse import urlsplit

from fastapi import Request


def _normalize_hostname(value: str | None) -> str:
    candidate = str(value or "").strip().lower().rstrip(".")
    if not candidate:
        return ""
    if "://" in candidate:
        candidate = urlsplit(candidate).hostname or ""
    elif candidate.startswith("["):
        candidate = candidate.split("]", 1)[0].lstrip("[")
    else:
        candidate = candidate.split(":", 1)[0]
    return candidate.rstrip(".")


def solo_registration_hosts() -> frozenset[str]:
    raw = os.getenv("SOLO_REGISTRATION_HOSTS", "")
    return frozenset(
        hostname
        for hostname in (_normalize_hostname(item) for item in raw.split(","))
        if hostname
    )


def is_solo_hostname(hostname: str | None) -> bool:
    normalized = _normalize_hostname(hostname)
    return bool(normalized and normalized in solo_registration_hosts())


def is_solo_request(request: Request) -> bool:
    return is_solo_hostname(request.url.hostname)


def solo_frontend_base_url(request: Request) -> str:
    """Return the configured Solo origin after the request host passed allowlisting."""
    configured = os.getenv("SOLO_FRONTEND_BASE_URL", "").strip().rstrip("/")
    return configured or str(request.base_url).rstrip("/")
