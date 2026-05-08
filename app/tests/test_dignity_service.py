from types import SimpleNamespace

from app.services.dignity_service import DignityService
from app.services.preferences_runtime import PreferencesRuntimeResolver


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, rows):
        self._rows = rows

    def query(self, _model):
        return _FakeQuery(self._rows)


def _build_sign_rows():
    return [
        SimpleNamespace(sign='Aries', element='Fire', mode='Cardinal', gender='Masculine', zone='Brahma', life_quadrant='Childhood', ruler='Mars', co_ruler=None, exaltation='Sun', detriment='Venus', fall='Saturn'),
        SimpleNamespace(sign='Libra', element='Air', mode='Cardinal', gender='Masculine', zone='Vishnu', life_quadrant='Youth', ruler='Venus', co_ruler='Chiron', exaltation='Saturn', detriment='Mars', fall='Sun'),
    ]


def test_dignity_service_treats_fallback_co_ruler_as_domicile_and_detriment():
    service = DignityService(db_session=None)

    assert service.calculate_dignity('Chiron', 'Libra') == 'domicile'
    assert service.calculate_dignity('Chiron', 'Aries') == 'detriment'


def test_dignity_service_uses_astrologer_preference_overrides(monkeypatch):
    rows = _build_sign_rows()
    session = _FakeSession(rows)

    monkeypatch.setattr(
        PreferencesRuntimeResolver,
        'get_dignity_settings_for_astrologer',
        lambda self, astrologer_id, default_house_system='P': {
            'version': 1,
            'signs': {
                'Aries': {'ruler': 'Pluto', 'co_ruler': 'Mars', 'exaltation': 'Sun'},
                'Libra': {'ruler': 'Venus', 'co_ruler': 'Chiron', 'exaltation': 'Saturn'},
            },
        },
    )

    service = DignityService(db_session=session, astrologer_id='astrologer-1')

    assert service.get_house_ruler('Aries') == 'Pluto'
    assert service.get_sign_co_ruler('Aries') == 'Mars'
    assert service.calculate_dignity('Pluto', 'Aries') == 'domicile'
    assert service.calculate_dignity('Mars', 'Libra') == 'detriment'
