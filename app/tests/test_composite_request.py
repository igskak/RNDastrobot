"""Validation tests for the composite request model (exactly-one-of partner source)."""
import uuid

import pytest
from pydantic import ValidationError

from app.api.routes.composite import CompositeRequest, PartnerBirthData


_PBD = {
    "name": "Partner",
    "date": "1990-06-26",
    "time": "12:00:00",
    "timezone": "Europe/Kyiv",
    "latitude": 50.0,
    "longitude": 30.0,
}


def test_partner_id_only_is_valid():
    req = CompositeRequest(user_id=uuid.uuid4(), partner_id=uuid.uuid4())
    assert req.partner_birth_data is None


def test_partner_birth_data_only_is_valid():
    req = CompositeRequest(user_id=uuid.uuid4(), partner_birth_data=_PBD)
    assert isinstance(req.partner_birth_data, PartnerBirthData)
    assert req.partner_id is None


def test_both_partner_sources_rejected():
    with pytest.raises(ValidationError):
        CompositeRequest(
            user_id=uuid.uuid4(), partner_id=uuid.uuid4(), partner_birth_data=_PBD
        )


def test_neither_partner_source_rejected():
    with pytest.raises(ValidationError):
        CompositeRequest(user_id=uuid.uuid4())


def test_malformed_birth_data_rejected():
    bad = {**_PBD, "date": "not-a-date"}
    with pytest.raises(ValidationError):
        CompositeRequest(user_id=uuid.uuid4(), partner_birth_data=bad)
