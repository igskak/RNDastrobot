"""
Tests for the Layer-1 data tools + frozen per-turn dataset assembler.

No DB: a fake DignityService (patched into the module) supplies sign properties
and counts its own instantiations so we can prove the assembler reuses ONE engine
service per turn (the N+1 guard from the eng review).
"""
from uuid import uuid4

import pytest

import app.services.astro_data_tools as dt
from app.services.astro_data_tools import CHART_DATA_FACETS, ChartDataset, get_chart_data
from app.services.preferences_runtime import CANONICAL_SIGNS


class _FakeDignity:
    instances = 0

    def __init__(self, **kwargs):
        type(self).instances += 1
        self.kwargs = kwargs

    def get_sign_properties(self, sign):
        return {"element": "Fire" if sign == "Aries" else "Earth", "ruler": "Mars"}


@pytest.fixture(autouse=True)
def _patch_dignity(monkeypatch):
    _FakeDignity.instances = 0
    monkeypatch.setattr(dt, "DignityService", _FakeDignity)


def _dataset():
    return ChartDataset(user_id=uuid4(), astrologer_id=uuid4(), db=None, house_system="P")


def test_sign_properties_facet_covers_every_sign():
    out = get_chart_data(_dataset(), "sign_properties")
    assert out["status"] == "ok"
    assert out["facet"] == "sign_properties"
    assert set(out["data"].keys()) == set(CANONICAL_SIGNS)
    assert len(out["data"]) == 12
    assert out["data"]["Aries"]["element"] == "Fire"
    assert out["provenance"]["dataset"]  # non-empty hash


def test_bad_facet_returns_machine_error_not_throw():
    out = get_chart_data(_dataset(), "nonsense")
    assert out["status"] == "error"
    assert out["error"] == "bad_facet:nonsense"


def test_only_implemented_facets_are_advertised():
    # The tool-schema enum reads CHART_DATA_FACETS; it must equal what the
    # assembler can actually build, or the model will call a dead facet.
    assert set(CHART_DATA_FACETS) == set(dt._FACET_BUILDERS)


def test_engine_service_is_reused_once_per_turn():
    ds = _dataset()
    ds.facet("sign_properties")
    ds.facet("sign_properties")  # second access must hit the memoized value
    ds.facet("sign_properties")
    assert _FakeDignity.instances == 1  # DignityService built once, not per call


def test_provenance_hash_is_deterministic_and_reflects_touched_facets():
    ds1 = _dataset()
    ds2 = _dataset()
    assert ds1.provenance_hash() == ds2.provenance_hash()  # empty == empty, stable
    ds1.facet("sign_properties")
    assert ds1.touched_facets() == ["sign_properties"]
    # touching a facet changes the hash (it now covers real data)
    assert ds1.provenance_hash() != ds2.provenance_hash()
    # same touched set + same data -> same hash across datasets
    ds2.facet("sign_properties")
    assert ds1.provenance_hash() == ds2.provenance_hash()


def test_memoization_returns_same_object():
    ds = _dataset()
    first = ds.facet("sign_properties")
    second = ds.facet("sign_properties")
    assert first is second
