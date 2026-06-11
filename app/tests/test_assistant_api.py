"""
Tests for the assistant aspect-passes request contract.

The endpoint's defense against the model inventing body/aspect labels lives in
the request schema (deterministic enums + window-mode coherence). These run
without a database.
"""
from datetime import date
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.routes.assistant import AspectPassesRequest


def _base(**overrides):
    data = {
        'user_id': uuid4(),
        'transit_body': 'Uranus',
        'natal_body': 'Venus',
        'aspect_type': 'Conjunction',
        'timezone': 'Europe/Kiev',
    }
    data.update(overrides)
    return data


def test_valid_next_contact_request():
    req = AspectPassesRequest(**_base())
    assert req.mode == 'next_contact'
    assert req.transit_body == 'Uranus'


def test_valid_window_request():
    req = AspectPassesRequest(**_base(
        mode='window', start_date=date(2026, 1, 1), end_date=date(2028, 1, 1)))
    assert req.mode == 'window'


@pytest.mark.parametrize('field,bad', [
    ('transit_body', 'Vulcan'),
    ('natal_body', 'Nibiru'),
    ('aspect_type', 'Octile'),
    ('timezone', 'Mars/Olympus'),
    ('mode', 'sideways'),
])
def test_rejects_invalid_enum_values(field, bad):
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(**{field: bad}))


def test_window_mode_requires_both_dates():
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(mode='window', start_date=date(2026, 1, 1)))


def test_window_mode_rejects_inverted_range():
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(
            mode='window', start_date=date(2028, 1, 1), end_date=date(2026, 1, 1)))


def test_max_expansion_days_bounded():
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(max_expansion_days=999999))


def test_angle_and_node_targets_allowed():
    AspectPassesRequest(**_base(natal_body='ASC'))
    AspectPassesRequest(**_base(transit_body='Saturn', natal_body='MC'))
    AspectPassesRequest(**_base(transit_body='TrueNorthNode', natal_body='Sun'))
