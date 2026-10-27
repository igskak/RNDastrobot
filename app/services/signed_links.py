"""Signed links for public products without accounts (kundli forecasts, moon letters).

A token is the row id plus a truncated HMAC of it, URL-safe. The link is the only credential,
so nothing secret is stored next to the row; each product signs with its own secret.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import uuid
from typing import Optional


def make_token(subject_id: uuid.UUID, secret: bytes) -> str:
    raw = subject_id.bytes
    signature = hmac.new(secret, raw, hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(raw + signature).decode("ascii").rstrip("=")


def parse_token(token: str, secret: bytes) -> Optional[uuid.UUID]:
    """The id inside a token, or None when the token is malformed or not ours."""
    try:
        padded = token + "=" * (-len(token) % 4)
        blob = base64.urlsafe_b64decode(padded.encode("ascii"))
        raw, signature = blob[:16], blob[16:]
        if len(raw) != 16 or len(signature) != 16:
            return None
        expected = hmac.new(secret, raw, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(signature, expected):
            return None
        return uuid.UUID(bytes=raw)
    except Exception:
        return None
