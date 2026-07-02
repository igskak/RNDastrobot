"""Marketing attribution (UTM / referrer) capture — CMO funnel (G2).

First-touch attribution is captured client-side by analytics.js and persisted in
the `steliara_attribution` cookie (JSON). The server reads it here at signup and
stores it on the auth.register audit event's `properties`, which is both the
source of truth for CAC/channel-mix and (via the PostHog mirror) the campaign
context on the registration event.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import Request

logger = logging.getLogger(__name__)

ATTRIBUTION_COOKIE = "steliara_attribution"

# Whitelisted keys only — never trust arbitrary cookie content into our log.
# gclid/gbraid/wbraid are Google Ads click identifiers needed for offline
# conversion import (OCI); they arrive in the landing URL and are persisted
# client-side in the same cookie so they survive the OAuth redirect.
_ALLOWED_KEYS = (
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "referrer",
    "landing_path",
    "gclid",
    "gbraid",
    "wbraid",
)

# Subset of the above that identifies a paid ad click (used for OCI storage).
AD_CLICK_KEYS = ("gclid", "gbraid", "wbraid")

_MAX_VALUE_LEN = 512


def read_attribution(request: Request) -> Optional[dict]:
    """Parse the attribution cookie into a sanitised dict, or None."""
    raw = request.cookies.get(ATTRIBUTION_COOKIE)
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict):
        return None

    out: dict = {}
    for key in _ALLOWED_KEYS:
        value = data.get(key)
        if isinstance(value, str) and value:
            out[key] = value[:_MAX_VALUE_LEN]
    return out or None
