from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import (
    AssistantConversation,
    AssistantMessage,
    AssistantTurnMetric,
    Base,
)
from app.services.assistant_log_service import (
    export_turns,
    flag_turn_correction,
    get_conversation,
    list_conversations,
    log_turn,
    set_turn_feedback,
)


def _metric_id(db, conversation_id):
    return db.query(AssistantTurnMetric).filter_by(
        conversation_id=conversation_id).one().id


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[
            AssistantConversation.__table__,
            AssistantMessage.__table__,
            AssistantTurnMetric.__table__,
        ],
    )
    return sessionmaker(bind=engine)()


def _log(db, astrologer_id, chart_user_id, conversation_id=None, text="Question"):
    conv_id, _ = log_turn(
        db,
        astrologer_id=astrologer_id,
        chart_user_id=chart_user_id,
        conversation_id=conversation_id,
        user_message=text,
        assistant_reply="Answer",
        metrics={},
        max_iterations_reached=False,
    )
    return conv_id


def test_new_turn_is_saved_and_loaded():
    db = _session()
    astrologer_id = uuid4()
    chart_user_id = uuid4()

    conversation_id = _log(db, astrologer_id, chart_user_id)
    loaded = get_conversation(
        db, astrologer_id=astrologer_id, conversation_id=conversation_id)

    assert loaded["title"] == "Question"
    assert [message["role"] for message in loaded["messages"]] == ["user", "assistant"]
    assert [message["content"] for message in loaded["messages"]] == ["Question", "Answer"]


def test_existing_thread_is_appended_and_moves_to_top():
    db = _session()
    astrologer_id = uuid4()
    chart_user_id = uuid4()
    first_id = _log(db, astrologer_id, chart_user_id, text="First")
    second_id = _log(db, astrologer_id, chart_user_id, text="Second")

    first = db.get(AssistantConversation, first_id)
    first.updated_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    db.commit()
    assert _log(db, astrologer_id, chart_user_id, first_id, "Follow-up") == first_id

    listed = list_conversations(db, astrologer_id=astrologer_id, chart_user_id=chart_user_id)
    assert [item["id"] for item in listed] == [str(first_id), str(second_id)]
    assert listed[0]["message_count"] == 4


def test_turn_capture_is_persisted():
    db = _session()
    astrologer_id = uuid4()
    chart = uuid4()
    conv_id, _ = log_turn(
        db, astrologer_id=astrologer_id, chart_user_id=chart, conversation_id=None,
        user_message="q", assistant_reply="a", metrics={"model": "m"},
        max_iterations_reached=False,
        guardrail="degraded",
        tool_results=[{"name": "analyze", "result": {"rows": []}}],
        workspace_manifest={"activeChart": {"chartId": "x"}},
    )
    m = db.query(AssistantTurnMetric).filter_by(conversation_id=conv_id).one()
    assert m.guardrail == "degraded"
    assert m.tool_results == [{"name": "analyze", "result": {"rows": []}}]
    assert m.workspace_manifest == {"activeChart": {"chartId": "x"}}
    assert m.correction_flag is False  # not yet corrected


def test_log_turn_returns_conversation_and_metric_ids():
    db = _session()
    conv_id, metric_id = log_turn(
        db, astrologer_id=uuid4(), chart_user_id=uuid4(), conversation_id=None,
        user_message="q", assistant_reply="a", metrics={}, max_iterations_reached=False)
    assert conv_id is not None and metric_id is not None
    m = db.query(AssistantTurnMetric).filter_by(id=metric_id).one()
    assert m.conversation_id == conv_id  # the id points at THIS turn's metric


def test_capture_is_optional_backward_compatible():
    """Existing callers omit capture args -> row still writes with NULL/defaults."""
    db = _session()
    astrologer_id = uuid4()
    conv_id = _log(db, astrologer_id, uuid4())  # legacy call, no capture
    m = db.query(AssistantTurnMetric).filter_by(conversation_id=conv_id).one()
    assert m.guardrail is None
    assert m.tool_results is None
    assert m.correction_flag is False


def test_flag_turn_correction_by_owner():
    db = _session()
    astro = uuid4()
    conv = _log(db, astro, uuid4())
    mid = _metric_id(db, conv)
    assert flag_turn_correction(db, astrologer_id=astro, metric_id=mid, note="wrong count") is True
    m = db.query(AssistantTurnMetric).filter_by(id=mid).one()
    assert m.correction_flag is True
    assert m.correction_note == "wrong count"


def test_flag_turn_correction_is_tenant_scoped():
    """Astrologer B cannot flag astrologer A's turn (cross-tenant denied)."""
    db = _session()
    astro_a, astro_b = uuid4(), uuid4()
    conv = _log(db, astro_a, uuid4())
    mid = _metric_id(db, conv)
    assert flag_turn_correction(db, astrologer_id=astro_b, metric_id=mid) is False
    m = db.query(AssistantTurnMetric).filter_by(id=mid).one()
    assert m.correction_flag is False  # A's turn untouched by B


def test_export_is_tenant_scoped():
    """Export returns ONLY the calling astrologer's turns."""
    db = _session()
    astro_a, astro_b = uuid4(), uuid4()
    _log(db, astro_a, uuid4(), text="A1")
    _log(db, astro_a, uuid4(), text="A2")
    _log(db, astro_b, uuid4(), text="B1")

    exported_a = export_turns(db, astrologer_id=astro_a)
    assert len(exported_a) == 2
    exported_b = export_turns(db, astrologer_id=astro_b)
    assert len(exported_b) == 1
    # no B data leaks into A's export
    assert all(row["conversation_id"] for row in exported_a)


def test_export_corrections_only_filters():
    db = _session()
    astro = uuid4()
    c1 = _log(db, astro, uuid4(), text="q1")
    _log(db, astro, uuid4(), text="q2")
    flag_turn_correction(db, astrologer_id=astro, metric_id=_metric_id(db, c1))

    assert len(export_turns(db, astrologer_id=astro)) == 2
    flagged = export_turns(db, astrologer_id=astro, corrections_only=True)
    assert len(flagged) == 1
    assert flagged[0]["correction_flag"] is True


def test_feedback_like_records_positive_signal():
    db = _session()
    astro = uuid4()
    mid = _metric_id(db, _log(db, astro, uuid4()))
    assert set_turn_feedback(db, astrologer_id=astro, metric_id=mid, kind="like") is True
    m = db.query(AssistantTurnMetric).filter_by(id=mid).one()
    assert m.feedback == "like"
    assert m.correction_flag is False  # a like is not a correction


def test_feedback_dislike_also_flags_correction_with_note():
    db = _session()
    astro = uuid4()
    mid = _metric_id(db, _log(db, astro, uuid4()))
    assert set_turn_feedback(db, astrologer_id=astro, metric_id=mid,
                             kind="dislike", note="wrong language") is True
    m = db.query(AssistantTurnMetric).filter_by(id=mid).one()
    assert m.feedback == "dislike"
    assert m.correction_flag is True
    assert m.correction_note == "wrong language"


def test_feedback_is_tenant_scoped():
    db = _session()
    astro_a, astro_b = uuid4(), uuid4()
    mid = _metric_id(db, _log(db, astro_a, uuid4()))
    assert set_turn_feedback(db, astrologer_id=astro_b, metric_id=mid, kind="like") is False
    assert db.query(AssistantTurnMetric).filter_by(id=mid).one().feedback is None


def test_feedback_bad_kind_rejected():
    db = _session()
    astro = uuid4()
    mid = _metric_id(db, _log(db, astro, uuid4()))
    assert set_turn_feedback(db, astrologer_id=astro, metric_id=mid, kind="meh") is False


def test_thread_cannot_be_appended_from_another_chart():
    db = _session()
    astrologer_id = uuid4()
    first_chart = uuid4()
    second_chart = uuid4()
    first_id = _log(db, astrologer_id, first_chart)

    second_id = _log(db, astrologer_id, second_chart, first_id, "Other chart")

    assert second_id != first_id
    assert get_conversation(
        db, astrologer_id=astrologer_id, conversation_id=first_id)["chart_user_id"] == str(first_chart)
    assert get_conversation(
        db, astrologer_id=astrologer_id, conversation_id=second_id)["chart_user_id"] == str(second_chart)
