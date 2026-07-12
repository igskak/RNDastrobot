"""Best-effort server-side mirroring of audit events into PostHog.

This is the "Layer B" bridge from the plan: the canonical audit_events log stays
the source of truth, while a curated set of *value* actions is also forwarded to
PostHog so marketing -> activation funnels can be built alongside the
client-side (Layer A) behavioural data, keyed by the same identity
(distinct_id = astrologer id, plus the shared session_id).

Design constraints:
  - No-op when POSTHOG_PROJECT_API_KEY is unset (local dev / not provisioned).
  - Only the *project token* is required — PostHog's capture endpoint accepts it
    (write-only, public-safe); the Personal API key is NOT needed here.
  - Fire-and-forget on a daemon thread with a short timeout: analytics must
    never add latency to or break the business request.
  - Uses stdlib urllib only (matches app/auth/mailer.py; no new dependency).
"""
from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional
from urllib import request as urllib_request

logger = logging.getLogger(__name__)


# Curated allowlist of high-signal "value" actions worth mirroring. Read-heavy
# / noisy actions (chart.get, person.list, *.calculate, ...) stay out to control
# volume and keep PostHog funnels clean. Extend deliberately.
VALUE_ACTIONS = frozenset({
    "auth.register",
    "auth.login",
    "auth.google",
    "auth.verify-email",
    "person.create",
    "chart.create",
    "client.natal.open",
    "client.assistant.chat",
    "first_chart_viewed",
    "assistant_cta_clicked",
    "onboarding_shown",
    "onboarding_started",
    "onboarding_step_completed",
    "onboarding_completed",
    "onboarding_dismissed",
    "call_session.create",
    "consultation.create",
    "billing.checkout.create",
})

_POSTHOG_TIMEOUT_SECONDS = 5


def _posthog_key() -> str:
    return os.getenv("POSTHOG_PROJECT_API_KEY", "").strip()


def _posthog_host() -> str:
    return os.getenv("POSTHOG_HOST", "https://eu.i.posthog.com").rstrip("/")


def _post_capture(payload: dict) -> None:
    """Send a single capture payload to PostHog. Runs on a daemon thread."""
    endpoint = _posthog_host() + "/capture/"
    req = urllib_request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=_POSTHOG_TIMEOUT_SECONDS) as response:
            # Drain/ignore body; PostHog returns 200 with {"status": 1}.
            if not (200 <= response.status < 300):
                logger.warning("PostHog capture non-2xx: %s", response.status)
    except Exception as exc:  # pragma: no cover - best effort
        logger.debug("PostHog capture failed: %s", exc)


def mirror_audit_event(
    *,
    actor_id,
    action: str,
    result: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    session_id: Optional[str] = None,
    properties: Optional[dict] = None,
) -> None:
    """Mirror a value action to PostHog if configured. Never raises."""
    try:
        key = _posthog_key()
        # Skip when not provisioned, when there's no identity to attribute to,
        # or when the action isn't on the value allowlist.
        if not key or actor_id is None or action not in VALUE_ACTIONS:
            return

        props = dict(properties or {})
        props.update({
            "result": result,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "source": "server",
        })
        if session_id:
            # $session_id ties server events to the client-side session.
            props["$session_id"] = session_id

        payload = {
            "api_key": key,
            "event": action,
            "distinct_id": str(actor_id),
            "properties": props,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        threading.Thread(target=_post_capture, args=(payload,), daemon=True).start()
    except Exception as exc:  # pragma: no cover - best effort
        logger.debug("mirror_audit_event skipped: %s", exc)
