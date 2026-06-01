"""
Spike-тесты для NatalContext (план UNIFIED_WORKSPACE_PIVOT_PLAN.md — Фаза 1, D3).

Доказывают:
1. Адаптер calc_result → внутренняя форма даёт ту же структуру, что DB-путь
   (_load_natal_data) — основа parity (Findings M1).
2. Применяются прогностические исключения.
3. from_inline переносит astrologer_id и house_system.
4. ГЛАВНОЕ: транзиты считаются для inline-натала БЕЗ сохранённого клиента и БЕЗ БД
   (calculate_transits_from_context с ephemeral-контекстом).
"""
from collections import namedtuple
from datetime import date, time
from uuid import uuid4

from app.services.natal_context import NatalContext, natal_data_from_calc_result
from app.services.natal_chart_service import NatalChartService
from app.services.transit_service import TransitService
from app.services.progression_service import ProgressionService
from app.services.direction_service import DirectionService
from app.utils.ephemeris import get_ephemeris_path


def _sample_calc_result():
    return {
        'birth_data': {'house_system': 'K', 'date': '1990-09-11'},
        'planets': [
            {'name': 'Sun', 'longitude': 168.5},
            {'name': 'Moon', 'longitude': 12.0},
        ],
        'special_points': {
            'TrueNorthNode': {'longitude': 300.1},
            'BlackMoon': {'longitude': 45.2},
        },
        'angles': {
            'ASC': {'longitude': 100.0},
            'MC': {'longitude': 10.0},
            'IC': {'longitude': 190.0},
            'DSC': {'longitude': 280.0},
            'Vertex': {'longitude': 222.2},
            'AntiVertex': {'longitude': 42.2},  # DB-путь его НЕ включает — проверяем зеркало
        },
        'houses': [
            {'number': 1, 'longitude': 100.0},
            {'number': 2, 'longitude': 130.0},
        ],
    }


def test_adapter_produces_internal_natal_shape():
    data = natal_data_from_calc_result(_sample_calc_result(), apply_exclusions=False)

    assert data['planets'] == [
        {'name': 'Sun', 'longitude': 168.5, 'type': 'planet'},
        {'name': 'Moon', 'longitude': 12.0, 'type': 'planet'},
    ]
    assert {'name': 'TrueNorthNode', 'longitude': 300.1, 'type': 'special_point'} in data['special_points']
    # Углы: ASC/MC/IC/DSC + Vertex, но НЕ AntiVertex (зеркалим DB-путь)
    angle_names = [a['name'] for a in data['angles']]
    assert angle_names == ['ASC', 'MC', 'IC', 'DSC', 'Vertex']
    assert data['houses'] == [
        {'number': 1, 'longitude': 100.0},
        {'number': 2, 'longitude': 130.0},
    ]
    # all_objects = planets + special_points + angles
    assert len(data['all_objects']) == len(data['planets']) + len(data['special_points']) + len(data['angles'])


def test_adapter_applies_prognostic_exclusions():
    from app.utils.constants import PROGNOSTIC_EXCLUDED_NATAL_TARGETS

    calc = _sample_calc_result()
    # Подмешиваем заведомо исключённую цель, если такая есть в наборе
    if PROGNOSTIC_EXCLUDED_NATAL_TARGETS:
        excluded_name = next(iter(PROGNOSTIC_EXCLUDED_NATAL_TARGETS))
        calc['planets'].append({'name': excluded_name, 'longitude': 5.0})

        with_excl = natal_data_from_calc_result(calc, apply_exclusions=True)
        without_excl = natal_data_from_calc_result(calc, apply_exclusions=False)

        all_names_with = {o['name'] for o in with_excl['all_objects']}
        all_names_without = {o['name'] for o in without_excl['all_objects']}
        assert excluded_name not in all_names_with
        assert excluded_name in all_names_without


def test_from_inline_carries_astrologer_and_house_system():
    astro_id = uuid4()
    ctx = NatalContext.from_inline(_sample_calc_result(), astrologer_id=astro_id)

    assert ctx.astrologer_id == astro_id
    assert ctx.house_system == 'K'         # из birth_data
    assert ctx.user_id is None
    assert ctx.is_ephemeral is True
    assert ctx.natal_data['planets'][0]['name'] == 'Sun'


# Минимальный фейковый тип аспекта (ref-данные в норме лежат в БД).
FakeAspect = namedtuple('FakeAspect', ['aspect_type', 'exact_angle', 'class_', 'character'])


def test_inline_transits_compute_without_saved_user_or_db(monkeypatch):
    """Ядро спайка: транзиты для inline-натала, ноль БД, ноль сохранённого клиента."""
    ephe = get_ephemeris_path()

    # 1. Считаем inline-натал (явные lat/lon → без сети-геокодинга, save_to_db=False)
    natal_service = NatalChartService(ephe_path=ephe)
    calc_result = natal_service.calculate_natal_chart(
        birth_date=date(1990, 9, 11),
        birth_time=time(10, 30, 0),
        timezone='Europe/Kiev',
        place='Kyiv',
        latitude=50.45,
        longitude=30.52,
        house_system='P',
        save_to_db=False,
    )

    # 2. Строим ephemeral-контекст (astrologer_id=None → дефолтные орбисы, без БД)
    context = NatalContext.from_inline(calc_result, astrologer_id=None)

    # 3. Транзиты без БД. _get_aspect_types обычно читает БД — мокаем ref-данные.
    service = TransitService(db_session=None, ephe_path=ephe)
    monkeypatch.setattr(
        service, '_get_aspect_types',
        lambda: [
            FakeAspect('conjunction', 0.0, 'major', 'neutral'),
            FakeAspect('opposition', 180.0, 'major', 'tense'),
            FakeAspect('trine', 120.0, 'major', 'harmonious'),
            FakeAspect('square', 90.0, 'major', 'tense'),
            FakeAspect('sextile', 60.0, 'minor', 'harmonious'),
        ],
    )

    result = service.calculate_transits_from_context(
        context,
        transit_date=date(2026, 6, 1),
        transit_time=time(12, 0, 0),
        timezone='Europe/Kiev',
        location='Kyiv',
        latitude=50.45,
        longitude=30.52,
    )

    # Транзитные планеты посчитаны, аспекты к наталу есть, дома проставлены
    assert result['transit_planets'], "ожидались транзитные планеты"
    assert result['transit_houses'], "ожидались транзитные дома (передали lat/lon)"
    assert isinstance(result['aspects'], list)
    assert len(result['aspects']) > 0, "ожидались транзит→натал аспекты"
    for asp in result['aspects']:
        assert 'transit_planet' in asp and 'natal_object' in asp
        assert asp['aspect_type'] in {'conjunction', 'opposition', 'trine', 'square', 'sextile'}


def _inline_natal_context():
    """Inline-натал → ephemeral NatalContext (для прогрессий/дирекций)."""
    ephe = get_ephemeris_path()
    calc_result = NatalChartService(ephe_path=ephe).calculate_natal_chart(
        birth_date=date(1990, 9, 11),
        birth_time=time(10, 30, 0),
        timezone='Europe/Kiev',
        place='Kyiv',
        latitude=50.45,
        longitude=30.52,
        house_system='P',
        save_to_db=False,
    )
    return NatalContext.from_inline(calc_result, astrologer_id=None), ephe


def _mock_aspect_types(monkeypatch, service):
    monkeypatch.setattr(
        service, '_get_aspect_types',
        lambda: [
            FakeAspect('conjunction', 0.0, 'major', 'neutral'),
            FakeAspect('opposition', 180.0, 'major', 'tense'),
            FakeAspect('trine', 120.0, 'major', 'harmonious'),
            FakeAspect('square', 90.0, 'major', 'tense'),
            FakeAspect('sextile', 60.0, 'minor', 'harmonious'),
        ],
    )


def test_inline_progression_computes_without_saved_user_or_db(monkeypatch):
    context, ephe = _inline_natal_context()
    # NatalContext несёт birth_jd/birth_date — прогрессии этого достаточно, ноль БД
    assert context.birth_jd is not None and context.birth_date is not None

    service = ProgressionService(db_session=None, ephe_path=ephe)
    _mock_aspect_types(monkeypatch, service)

    result = service.calculate_progression_from_context(
        context,
        target_date=date(2026, 6, 1),
        target_time=time(12, 0, 0),
        timezone='Europe/Kiev',
    )
    assert result['progressed_planets'], "ожидались прогрессивные планеты"
    assert isinstance(result['aspects_to_natal'], list)
    assert len(result['aspects_to_natal']) > 0, "ожидались прогрессия→натал аспекты"
    assert result['birth_data']['user_id'] is None  # ephemeral


def test_inline_direction_computes_without_saved_user_or_db(monkeypatch):
    context, ephe = _inline_natal_context()
    service = DirectionService(db_session=None, ephe_path=ephe)
    _mock_aspect_types(monkeypatch, service)

    result = service.calculate_direction_from_context(
        context,
        target_date=date(2026, 6, 1),
        direction_type='zodiacal',
    )
    assert result['directed_planets'], "ожидались дирекционные планеты"
    assert isinstance(result['aspects_to_natal'], list)
    assert result['direction_info']['direction_type'] == 'zodiacal'
    assert result['birth_data']['user_id'] is None  # ephemeral
