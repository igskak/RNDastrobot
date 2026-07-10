from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.models.schemas import AccountPreferencesPatchRequest, OnboardingPreferences
from app.services.preferences_service import PreferencesService, build_default_preferences


class _Runtime:
    def build_default_methodology(self):
        return {'orbs': {}, 'balances': {}}

    def build_default_visual(self):
        return {'aspect_colors': {}, 'planet_colors': {}}

    def get_account_payload(self, _astrologer_id, *, default_house_system):
        return {
            'methodology': self.build_default_methodology(),
            'visual': self.build_default_visual(),
            'chart_creation_defaults': {'house_system': default_house_system},
        }

    def invalidate(self, _astrologer_id):
        return None


class _Db:
    def flush(self):
        return None


def _service_and_record():
    defaults = build_default_preferences('P')
    record = SimpleNamespace(
        version=1,
        chart_defaults=defaults['chart_defaults'],
        methodology=defaults['methodology'],
        visual=defaults['visual'],
        chart_creation_defaults=defaults['chart_creation_defaults'],
        onboarding={},
    )
    astrologer = SimpleNamespace(id='astro-1', default_house_system='P')
    service = PreferencesService.__new__(PreferencesService)
    service.db = _Db()
    service.runtime = _Runtime()
    service.get_or_create_account_record = lambda _astrologer: record
    return service, record, astrologer


def test_default_account_preferences_include_onboarding_state():
    service, _record, astrologer = _service_and_record()
    payload = service.get_account_preferences(astrologer)

    assert payload['onboarding'] == {
        'version': 1,
        'status': 'not_started',
        'completed_steps': [],
        'started_at': None,
        'dismissed_at': None,
        'completed_at': None,
    }


def test_patch_account_preferences_persists_onboarding_without_touching_other_defaults():
    service, record, astrologer = _service_and_record()
    updated = service.patch_account_preferences(astrologer, {
        'onboarding': {
            'version': 1,
            'status': 'active',
            'completed_steps': ['profile_chart'],
            'started_at': '2026-07-10T12:00:00Z',
            'dismissed_at': None,
            'completed_at': None,
        },
    })

    assert record.onboarding['status'] == 'active'
    assert updated['onboarding']['completed_steps'] == ['profile_chart']
    assert updated['chart_creation_defaults']['house_system'] == 'P'


def test_onboarding_schema_deduplicates_steps_and_rejects_unknown_values():
    state = OnboardingPreferences(
        status='active',
        completed_steps=['forecast_ready', 'profile_chart', 'profile_chart'],
    )
    assert state.completed_steps == ['profile_chart', 'forecast_ready']

    with pytest.raises(ValidationError):
        AccountPreferencesPatchRequest(onboarding={
            'version': 1,
            'status': 'active',
            'completed_steps': ['unknown_step'],
        })

    with pytest.raises(ValidationError):
        AccountPreferencesPatchRequest(onboarding={
            'version': 1,
            'status': 'paused',
            'completed_steps': [],
        })


def test_onboarding_migration_adds_non_null_jsonb_default():
    migration = Path('app/database/migrations/051_add_onboarding_preferences.sql').read_text()
    assert 'ADD COLUMN IF NOT EXISTS onboarding JSONB NOT NULL' in migration
    assert "DEFAULT '{}'::jsonb" in migration

