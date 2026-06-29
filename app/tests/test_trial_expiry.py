"""Trial -> read-only paywall flow.

New accounts get a full-Pro trial for TRIAL_PERIOD_DAYS. When plan_expires_at
passes with no active paid subscription, the effective plan becomes
PLAN_EXPIRED (read-only): live actions and chart/profile creation are blocked
via assert_account_writable, while reads stay allowed.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./_trial_expiry_test.db")
os.environ.setdefault("BILLING_PROVIDER", "stripe")

import types  # noqa: E402
from datetime import timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402

import app.services.billing_service as billing_service  # noqa: E402
from app.auth.security import utcnow  # noqa: E402
from app.services.entitlements_service import (  # noqa: E402
    PLAN_EXPIRED,
    PLAN_PRO,
    PLAN_SOLO,
    PLAN_TRIAL,
    assert_account_writable,
    get_entitlements,
    is_read_only_plan,
)


class _Astro:
    def __init__(self, plan_code=PLAN_TRIAL, plan_expires_at=None):
        self.id = "00000000-0000-0000-0000-000000000009"
        self.plan_code = plan_code
        self.plan_expires_at = plan_expires_at


def test_trial_entitlements_are_full_pro():
    ent = get_entitlements(_Astro(), plan_code=PLAN_TRIAL)
    assert ent["calls_enabled"] is True
    assert ent["recording_enabled"] is True
    assert ent["transcription_enabled"] is True
    assert ent["assistant_enabled"] is True
    assert ent["max_saved_charts"] is None  # no chart limit on trial


def test_solo_entitlements_keep_workspace_and_lock_communication_features():
    ent = get_entitlements(_Astro(), plan_code=PLAN_SOLO)
    assert ent["max_saved_charts"] is None
    assert ent["clients_enabled"] is True
    assert ent["consultations_enabled"] is False
    assert ent["calls_enabled"] is False
    assert ent["recording_enabled"] is False
    assert ent["transcription_enabled"] is False
    assert ent["meeting_stats_enabled"] is False
    assert ent["assistant_enabled"] is False


def test_expired_entitlements_are_read_only():
    ent = get_entitlements(_Astro(), plan_code=PLAN_EXPIRED)
    # Live actions off.
    assert ent["calls_enabled"] is False
    assert ent["recording_enabled"] is False
    assert ent["assistant_enabled"] is False
    # Reads still allowed via these flags.
    assert ent["clients_enabled"] is True
    assert ent["consultations_enabled"] is True
    # Chart/profile creation blocked (also drives the frontend popup).
    assert ent["max_saved_charts"] == 0


def test_assert_account_writable_blocks_expired():
    with pytest.raises(HTTPException) as exc_info:
        assert_account_writable(_Astro(), plan_code=PLAN_EXPIRED)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error_code"] == "TRIAL_ENDED"


@pytest.mark.parametrize("plan_code", [PLAN_TRIAL, PLAN_PRO])
def test_assert_account_writable_allows_active_plans(plan_code):
    assert_account_writable(_Astro(), plan_code=plan_code)  # must not raise


def test_is_read_only_plan():
    assert is_read_only_plan(PLAN_EXPIRED) is True
    assert is_read_only_plan(PLAN_TRIAL) is False
    assert is_read_only_plan(PLAN_PRO) is False


def test_effective_plan_expired_after_deadline(monkeypatch):
    monkeypatch.setattr(billing_service, "get_active_subscription", lambda db, aid: None)
    astro = _Astro(plan_code=PLAN_TRIAL, plan_expires_at=utcnow() - timedelta(days=1))
    assert billing_service.get_effective_plan_code(object(), astro) == PLAN_EXPIRED


def test_effective_plan_trial_before_deadline(monkeypatch):
    monkeypatch.setattr(billing_service, "get_active_subscription", lambda db, aid: None)
    astro = _Astro(plan_code=PLAN_TRIAL, plan_expires_at=utcnow() + timedelta(days=7))
    assert billing_service.get_effective_plan_code(object(), astro) == PLAN_TRIAL


def test_effective_plan_without_expiry_never_expires(monkeypatch):
    # Admin comps / legacy 'pro' default have no deadline and must not lock.
    monkeypatch.setattr(billing_service, "get_active_subscription", lambda db, aid: None)
    astro = _Astro(plan_code=PLAN_PRO, plan_expires_at=None)
    assert billing_service.get_effective_plan_code(object(), astro) == PLAN_PRO


def test_active_subscription_overrides_expired_trial(monkeypatch):
    fake_sub = types.SimpleNamespace(plan_code=PLAN_PRO)
    monkeypatch.setattr(billing_service, "get_active_subscription", lambda db, aid: fake_sub)
    astro = _Astro(plan_code=PLAN_TRIAL, plan_expires_at=utcnow() - timedelta(days=30))
    assert billing_service.get_effective_plan_code(object(), astro) == PLAN_PRO
