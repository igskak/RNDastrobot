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
    get_conversation,
    list_conversations,
    log_turn,
)


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
    return log_turn(
        db,
        astrologer_id=astrologer_id,
        chart_user_id=chart_user_id,
        conversation_id=conversation_id,
        user_message=text,
        assistant_reply="Answer",
        metrics={},
        max_iterations_reached=False,
    )


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
