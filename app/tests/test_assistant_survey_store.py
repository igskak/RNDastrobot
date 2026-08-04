"""§22.2 — persisted surveys: tenant scope, reuse, and failure behaviour."""
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import (
    AssistantConversation,
    AssistantMessage,
    AssistantSurvey,
    AssistantTurnMetric,
    Base,
)
from app.services.assistant_survey_store import list_surveys, load_survey, save_survey


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[
        AssistantConversation.__table__, AssistantMessage.__table__,
        AssistantTurnMetric.__table__, AssistantSurvey.__table__,
    ])
    return sessionmaker(bind=engine)()


def _events(n=2):
    return [{"event_id": f"e{i}", "transit_body": "Pluto", "natal_body": "Sun",
             "enter": f"2027-0{i + 1}-01", "leave": f"2027-0{i + 2}-01"} for i in range(n)]


def _save(db, **kw):
    base = dict(
        survey_id="ts_abc", astrologer_id=uuid4(), chart_user_id=uuid4(),
        conversation_id=None, parameters={"profile": {"transit": "outer_planets"}},
        events=_events(), summary={"event_count": 2}, methodology_hash="h1",
    )
    base.update(kw)
    assert save_survey(db, **base) is True
    return base


# --- round trip -----------------------------------------------------------------

def test_survey_round_trips_with_its_events():
    db = _session()
    saved = _save(db)
    got = load_survey(db, survey_id="ts_abc",
                      astrologer_id=saved["astrologer_id"],
                      chart_user_id=saved["chart_user_id"])
    assert got["event_count"] == 2
    assert [e["event_id"] for e in got["events"]] == ["e0", "e1"]
    assert got["parameters"]["profile"]["transit"] == "outer_planets"
    assert got["methodology_hash"] == "h1"


def test_resaving_the_same_id_refreshes_rather_than_collides():
    """survey_id is a hash of the parameters, so recomputing the same survey must
    update the row, not raise on the primary key."""
    db = _session()
    saved = _save(db)
    assert save_survey(
        db, survey_id="ts_abc", astrologer_id=saved["astrologer_id"],
        chart_user_id=saved["chart_user_id"], conversation_id=None,
        parameters={}, events=_events(5), summary=None, methodology_hash="h2") is True
    got = load_survey(db, survey_id="ts_abc", astrologer_id=saved["astrologer_id"])
    assert got["event_count"] == 5
    assert got["methodology_hash"] == "h2"
    assert db.query(AssistantSurvey).count() == 1


# --- tenancy: the scope check is the security boundary ---------------------------

def test_another_astrologer_cannot_load_the_survey():
    """A survey_id is derived from its parameters and therefore guessable. The
    scope check is what stops a guess from returning someone else's chart."""
    db = _session()
    _save(db)
    assert load_survey(db, survey_id="ts_abc", astrologer_id=uuid4()) is None


def test_a_different_chart_does_not_answer_from_this_survey():
    """A survey belongs to one chart; a request made while another chart is
    active must not silently answer from it."""
    db = _session()
    saved = _save(db)
    assert load_survey(db, survey_id="ts_abc",
                       astrologer_id=saved["astrologer_id"],
                       chart_user_id=uuid4()) is None


def test_missing_id_returns_none_not_an_error():
    db = _session()
    assert load_survey(db, survey_id="ts_nope", astrologer_id=uuid4()) is None


# --- listing ---------------------------------------------------------------------

def test_listing_omits_event_payloads():
    """A list of 400-event payloads is useless to page through."""
    db = _session()
    aid, cid = uuid4(), uuid4()
    for i in range(3):
        save_survey(db, survey_id=f"ts_{i}", astrologer_id=aid, chart_user_id=cid,
                    conversation_id=None, parameters={}, events=_events(4),
                    summary=None, methodology_hash=None)
    rows = list_surveys(db, astrologer_id=aid, chart_user_id=cid)
    assert len(rows) == 3
    assert all("events" not in r for r in rows)
    assert all(r["event_count"] == 4 for r in rows)


def test_listing_is_tenant_scoped():
    db = _session()
    save_survey(db, survey_id="ts_x", astrologer_id=uuid4(), chart_user_id=uuid4(),
                conversation_id=None, parameters={}, events=[], summary=None,
                methodology_hash=None)
    assert list_surveys(db, astrologer_id=uuid4()) == []


# --- failure must not cost the turn ----------------------------------------------

def test_persistence_failure_returns_false_instead_of_raising():
    """An answer that is already correct must not be lost because storage
    hiccuped."""
    class _BrokenSession:
        def get(self, *a, **kw):
            raise RuntimeError("db down")

        def rollback(self):
            pass

    assert save_survey(
        _BrokenSession(), survey_id="ts_x", astrologer_id=uuid4(),
        chart_user_id=uuid4(), conversation_id=None, parameters={},
        events=[], summary=None, methodology_hash=None) is False


def test_load_failure_returns_none_instead_of_raising():
    class _BrokenSession:
        def query(self, *a, **kw):
            raise RuntimeError("db down")

    assert load_survey(_BrokenSession(), survey_id="x", astrologer_id=uuid4()) is None


# --- the migration promises --------------------------------------------------------

def test_migration_056_is_idempotent():
    from pathlib import Path
    sql = Path("app/database/migrations/056_add_assistant_surveys.sql").read_text()
    assert "CREATE TABLE IF NOT EXISTS assistant_surveys" in sql
    assert sql.count("CREATE INDEX IF NOT EXISTS") >= 2
    # Cascades so a deleted astrologer does not leave orphaned chart data behind.
    assert "ON DELETE CASCADE" in sql
