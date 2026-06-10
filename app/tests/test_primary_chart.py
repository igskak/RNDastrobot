"""Тесты фичи aspects_to_<primary> — произвольная «первичная карта» как цель аспектов слоёв.

Покрывают:
1. NatalContext.with_primary строит aspect_reference (targets+houses) из calc_result.
2. effective_aspect_targets/effective_reference_houses: идентичность без первичной (REGRESSION)
   и переключение на первичную, когда она задана.
3. primary_chart_service.apply_primary: 'natal' → без изменений; невалидный method → ValueError;
   деривированный метод → оборачивает контекст целями первичной (через поддельный сервис, без swisseph).
4. calc_like-мапперы payload слоёв (direction/progression/solar) дают калк-форму для целей.

Намеренно без swisseph: всё на синтетических данных, тесты быстрые и детерминированные.
"""
import pytest

from app.services.natal_context import NatalContext, natal_data_from_calc_result
from app.services import primary_chart_service
from app.services.primary_chart_service import (
    apply_primary,
    _calc_like_from_direction,
    _calc_like_from_progression,
    _calc_like_from_solar,
    _angles_from_houses,
)


def _natal_calc_result():
    return {
        'birth_data': {'house_system': 'P', 'date': '1990-09-11'},
        'planets': [
            {'name': 'Sun', 'longitude': 168.5, 'speed': 0.98},
            {'name': 'Moon', 'longitude': 12.0, 'speed': 13.1},
        ],
        'special_points': {'TrueNorthNode': {'longitude': 300.1}},
        'angles': {
            'ASC': {'longitude': 100.0},
            'MC': {'longitude': 10.0},
            'IC': {'longitude': 190.0},
            'DSC': {'longitude': 280.0},
        },
        'houses': [{'number': n, 'longitude': (n - 1) * 30.0} for n in range(1, 13)],
    }


def _primary_calc_result():
    """Иная карта (как бы дирекционная): сдвинутые позиции и свои дома."""
    return {
        'planets': [
            {'name': 'Sun', 'longitude': 200.0, 'speed': 0.98},
            {'name': 'Mars', 'longitude': 88.0, 'speed': 0.5},
        ],
        'special_points': {},
        'angles': {'ASC': {'longitude': 130.0}, 'MC': {'longitude': 40.0}},
        'houses': [{'number': n, 'longitude': (n - 1) * 30.0 + 30.0} for n in range(1, 13)],
    }


def _base_context():
    return NatalContext(
        natal_data=natal_data_from_calc_result(_natal_calc_result()),
        astrologer_id=None,
        natal_aspect_targets=[{'name': 'Sun', 'longitude': 168.5, 'type': 'planet', 'speed': 0.98}],
    )


# --- NatalContext -----------------------------------------------------------

def test_without_primary_is_identity_regression():
    """REGRESSION: без первичной карты цели/дома слоя == натальный fallback (байт-в-байт)."""
    ctx = _base_context()
    fallback_targets = ctx.natal_data['all_objects']
    fallback_houses = ctx.natal_data['houses']

    assert ctx.has_primary is False
    assert ctx.effective_aspect_targets(fallback_targets) is fallback_targets
    assert ctx.effective_reference_houses(fallback_houses) is fallback_houses


def test_with_primary_builds_aspect_reference():
    ctx = NatalContext.with_primary(_base_context(), _primary_calc_result())

    assert ctx.has_primary is True
    target_names = {t['name'] for t in ctx.aspect_reference['targets']}
    assert {'Sun', 'Mars', 'ASC', 'MC'} <= target_names
    # дома первичной (со сдвигом +30) — не натальные
    assert ctx.aspect_reference['houses'][0] == {'number': 1, 'longitude': 30.0}


def test_with_primary_preserves_derivation_fields():
    """with_primary меняет ТОЛЬКО aspect_reference; натал/деривация субъекта сохраняются."""
    base = _base_context()
    ctx = NatalContext.with_primary(base, _primary_calc_result())
    assert ctx.natal_data is base.natal_data
    assert ctx.astrologer_id == base.astrologer_id


def test_effective_targets_switches_to_primary():
    ctx = NatalContext.with_primary(_base_context(), _primary_calc_result())
    fallback = ctx.natal_data['all_objects']
    targets = ctx.effective_aspect_targets(fallback)
    assert targets is not fallback
    assert any(t['name'] == 'Mars' for t in targets)  # Mars есть только в первичной


# --- apply_primary ----------------------------------------------------------

def test_apply_primary_natal_is_identity():
    base = _base_context()
    # db не используется для natal
    assert apply_primary(None, base, 'natal', {}) is base
    assert apply_primary(None, base, None, None) is base


def test_apply_primary_invalid_method_raises():
    with pytest.raises(ValueError):
        apply_primary(None, _base_context(), 'bogus', {})


def test_apply_primary_direction_wraps_context(monkeypatch):
    """Деривированный метод: apply_primary зовёт сервис (замокан) и оборачивает контекст
    целями первичной — без обращения к swisseph."""
    directed_payload = {
        'directed_planets': [{'name': 'Sun', 'longitude': 205.0, 'speed': 0.98}],
        'directed_special_points': [],
        'directed_angles': [{'name': 'ASC', 'longitude': 133.0}],
        'directed_houses': [{'number': n, 'longitude': (n - 1) * 30.0 + 33.0} for n in range(1, 13)],
    }

    class FakeDirectionService:
        def __init__(self, db):
            pass

        def calculate_direction_from_context(self, context, target_date, direction_type):
            assert direction_type == 'zodiacal'
            return directed_payload

    monkeypatch.setattr(
        'app.services.direction_service.DirectionService', FakeDirectionService
    )

    ctx = apply_primary(
        None, _base_context(), 'direction',
        {'target_date': '2025-01-01', 'direction_type': 'zodiacal'},
    )
    assert ctx.has_primary is True
    names = {t['name'] for t in ctx.aspect_reference['targets']}
    assert 'Sun' in names and 'ASC' in names
    assert ctx.aspect_reference['houses'][0]['longitude'] == 33.0


# --- calc_like мапперы ------------------------------------------------------

def test_calc_like_from_direction():
    payload = {
        'directed_planets': [{'name': 'Sun', 'longitude': 1.0}],
        'directed_special_points': [{'name': 'BlackMoon', 'longitude': 2.0}],
        'directed_angles': [{'name': 'ASC', 'longitude': 3.0}, {'name': 'MC', 'longitude': 4.0}],
        'directed_houses': [{'number': 1, 'longitude': 5.0}],
    }
    out = _calc_like_from_direction(payload)
    assert out['planets'] == payload['directed_planets']
    assert out['angles'] == {'ASC': {'longitude': 3.0}, 'MC': {'longitude': 4.0}}
    assert out['houses'] == payload['directed_houses']


def test_calc_like_from_progression_synthesizes_angles_from_houses():
    houses = [{'number': n, 'longitude': float(n)} for n in range(1, 13)]
    payload = {'progressed_planets': [{'name': 'Sun', 'longitude': 9.0}], 'progressed_houses': houses}
    out = _calc_like_from_progression(payload)
    # ASC = куспид I (1.0), MC = куспид X (10.0); DSC/IC противоположны
    assert out['angles']['ASC'] == {'longitude': 1.0}
    assert out['angles']['MC'] == {'longitude': 10.0}
    assert out['angles']['DSC'] == {'longitude': 181.0}
    assert out['houses'] is houses


def test_calc_like_from_solar_passthrough():
    payload = {
        'planets': [{'name': 'Sun', 'longitude': 1.0}],
        'angles': {'ASC': {'longitude': 2.0}},
        'houses': [{'number': 1, 'longitude': 3.0}],
    }
    out = _calc_like_from_solar(payload)
    assert out['planets'] == payload['planets']
    assert out['angles'] == payload['angles']
    assert out['houses'] == payload['houses']


def test_angles_from_houses_insufficient_returns_empty():
    assert _angles_from_houses([{'number': 1, 'longitude': 0.0}]) == {}
