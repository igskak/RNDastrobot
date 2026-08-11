"""Сбор тел карты для синастрических интер-аспектов.

Vertex/AntiVertex приходят одновременно в `special_points` и в `angles`.
Пока список не дедуплицировался, такое тело попадало в него дважды и каждый
его контакт с партнёром считался (и рисовался на колесе) по два раза.
"""
from app.services.synastry_service import SynastryService


CHART = {
    'planets': [
        {'name': 'Sun', 'longitude': 10.0, 'speed': 1.0, 'sign': 'Aries'},
        {'name': 'Moon', 'longitude': 40.0, 'speed': 13.0, 'sign': 'Taurus'},
    ],
    'special_points': {
        'Vertex': {'name': 'Vertex', 'longitude': 200.0, 'sign': 'Libra'},
        'PartOfFortune': {'name': 'PartOfFortune', 'longitude': 95.0, 'sign': 'Cancer'},
    },
    'angles': {
        'ASC': {'name': 'ASC', 'longitude': 120.0, 'sign': 'Leo'},
        'Vertex': {'name': 'Vertex', 'longitude': 200.0, 'sign': 'Libra'},
        'AntiVertex': {'name': 'AntiVertex', 'longitude': 20.0, 'sign': 'Aries'},
        'EastPoint': {'name': 'EastPoint', 'longitude': None},
    },
}


def _collect(include_angles=True):
    return SynastryService._collect_chart_objects(
        object.__new__(SynastryService), CHART, include_angles=include_angles
    )


def test_body_present_in_two_sections_is_collected_once():
    names = [obj['name'] for obj in _collect()]
    assert names.count('Vertex') == 1
    assert len(names) == len(set(names))


def test_first_section_wins_for_a_duplicated_body():
    by_name = {obj['name']: obj for obj in _collect()}
    # Vertex лежит и в special_points, и в angles — берём первое вхождение.
    assert by_name['Vertex']['type'] == 'special_point'
    assert by_name['ASC']['type'] == 'angle'
    assert by_name['Sun']['type'] == 'planet'


def test_angles_without_longitude_are_skipped():
    names = [obj['name'] for obj in _collect()]
    assert 'EastPoint' not in names
    assert 'AntiVertex' in names


def test_angles_can_be_excluded_entirely():
    names = [obj['name'] for obj in _collect(include_angles=False)]
    assert names == ['Sun', 'Moon', 'Vertex', 'PartOfFortune']
