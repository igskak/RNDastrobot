"""§26 — quality metrics over captured turns."""
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import (
    AssistantConversation,
    AssistantMessage,
    AssistantTurnMetric,
    Base,
)
from app.services.assistant_log_service import log_turn
from app.services.assistant_quality_metrics import (
    BULK_TOOLS,
    compute_quality_metrics,
    recent_ungrounded_turns,
)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[
        AssistantConversation.__table__, AssistantMessage.__table__,
        AssistantTurnMetric.__table__])
    return sessionmaker(bind=engine)()


def _turn(db, astrologer_id, **kw):
    base = dict(
        astrologer_id=astrologer_id, chart_user_id=uuid4(), conversation_id=None,
        user_message="q", assistant_reply="a", metrics={"model": "m"},
        max_iterations_reached=False,
    )
    base.update(kw)
    return log_turn(db, **base)


# --- persistence ------------------------------------------------------------------

def test_quality_signals_round_trip_onto_the_turn():
    """The date check already ran on every turn and its result was discarded;
    persisting it turns a one-off catch into a rate."""
    db = _session()
    _, metric_id = _turn(db, uuid4(), unsupported_dates=["2027-06-30"],
                         tools_used=["discover_patterns"], narrated=True)
    row = db.query(AssistantTurnMetric).filter_by(id=metric_id).one()
    assert row.unsupported_dates == ["2027-06-30"]
    assert row.tools_used == ["discover_patterns"]
    assert row.narrated is True


def test_a_turn_without_signals_still_logs():
    db = _session()
    _, metric_id = _turn(db, uuid4())
    row = db.query(AssistantTurnMetric).filter_by(id=metric_id).one()
    assert row.unsupported_dates is None
    assert row.tools_used is None


# --- the rate the whole slice rests on ---------------------------------------------

def test_bulk_tool_rate_counts_turns_that_took_the_intended_path():
    db = _session()
    aid = uuid4()
    _turn(db, aid, tools_used=["survey_transits"])
    _turn(db, aid, tools_used=["discover_patterns"])
    _turn(db, aid, tools_used=["find_aspect_passes"])
    _turn(db, aid, tools_used=["get_chart_data"])
    out = compute_quality_metrics(db, astrologer_id=aid)
    assert out["counts"]["bulk_turns"] == 2
    assert out["targets"]["bulk_tool_rate_of_tool_turns"] == 0.5


def test_pair_fanout_is_the_failure_the_bulk_tools_prevent():
    """Four one-pair calls in ONE turn is exactly the metric-167 failure."""
    db = _session()
    aid = uuid4()
    _turn(db, aid, tools_used=["find_aspect_passes"] * 4)
    _turn(db, aid, tools_used=["find_aspect_passes"])          # one is fine
    out = compute_quality_metrics(db, astrologer_id=aid)
    assert out["counts"]["pair_fanout_turns"] == 1


def test_ungrounded_dates_are_counted_per_turn_and_per_date():
    db = _session()
    aid = uuid4()
    _turn(db, aid, unsupported_dates=["2027-01-01", "2027-02-02"],
          tools_used=["discover_patterns"])
    _turn(db, aid, unsupported_dates=[], tools_used=["discover_patterns"])
    out = compute_quality_metrics(db, astrologer_id=aid)
    assert out["counts"]["ungrounded_turns"] == 1
    assert out["counts"]["ungrounded_dates"] == 2
    assert out["targets"]["unsupported_date_turn_rate"] == 0.5


def test_guardrail_and_tool_usage_are_broken_down():
    db = _session()
    aid = uuid4()
    _turn(db, aid, guardrail="ok", tools_used=["survey_transits", "analyze"])
    _turn(db, aid, guardrail="blocked", tools_used=["analyze"])
    out = compute_quality_metrics(db, astrologer_id=aid)
    assert out["guardrail"] == {"ok": 1, "blocked": 1}
    assert out["tool_usage"]["analyze"] == 2


def test_max_iteration_rate_is_tracked():
    db = _session()
    aid = uuid4()
    _turn(db, aid, max_iterations_reached=True)
    _turn(db, aid, max_iterations_reached=False)
    assert compute_quality_metrics(db, astrologer_id=aid)["targets"]["max_iteration_rate"] == 0.5


# --- honesty about empty data --------------------------------------------------------

def test_rates_are_none_not_zero_when_there_is_nothing_to_divide():
    """'No data' and 'zero percent' are different claims; reporting 0.0 for an
    empty denominator would assert a result we do not have."""
    db = _session()
    out = compute_quality_metrics(db, astrologer_id=uuid4())
    assert out["turns"] == 0
    assert out["targets"]["bulk_tool_rate_of_tool_turns"] is None
    assert out["targets"]["unsupported_date_turn_rate"] is None


def test_metrics_are_tenant_scoped():
    db = _session()
    mine, theirs = uuid4(), uuid4()
    _turn(db, theirs, tools_used=["survey_transits"])
    assert compute_quality_metrics(db, astrologer_id=mine)["turns"] == 0


# --- reading the fabrications by hand --------------------------------------------------

def test_ungrounded_turns_are_listable_for_inspection():
    db = _session()
    aid = uuid4()
    _turn(db, aid, unsupported_dates=["2027-06-30"], tools_used=["discover_patterns"])
    _turn(db, aid, unsupported_dates=[])
    rows = recent_ungrounded_turns(db, astrologer_id=aid)
    assert len(rows) == 1
    assert rows[0]["unsupported_dates"] == ["2027-06-30"]
    assert rows[0]["tools_used"] == ["discover_patterns"]


def test_bulk_tool_set_matches_the_tools_that_answer_a_period():
    assert "survey_transits" in BULK_TOOLS
    assert "discover_patterns" in BULK_TOOLS
    assert "find_aspect_passes" not in BULK_TOOLS


def test_migration_057_is_idempotent_and_nullable():
    from pathlib import Path
    sql = Path("app/database/migrations/057_add_assistant_turn_quality.sql").read_text()
    assert sql.count("IF NOT EXISTS") >= 4
    alter = sql.upper().split("ALTER TABLE", 1)[1].split(";", 1)[0]
    assert "NOT NULL" not in alter
