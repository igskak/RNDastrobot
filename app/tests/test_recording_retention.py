"""Consultation audio is deleted six months after it was recorded; nothing else is.

The terms of service, both in-call consent notices, the record-astrology-consultations
page and llms.txt all promise this, so these tests pin the behaviour the promise depends
on: which recordings go, which stay, that the transcript and summaries survive, and that
a failed storage delete never leaves the profile claiming audio is gone when it is not.
"""
import os
from datetime import datetime, timedelta
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "sqlite:///./_recording_retention_test.db")

import pytest  # noqa: E402

from app.database.models import CallSession  # noqa: E402
from app.services import recording_retention_service as retention  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, reset_sqlite_schema  # noqa: E402

engine, SessionFactory = create_sqlite_test_session_factory("./_recording_retention_test.sqlite3")

NOW = datetime(2026, 9, 25, 12, 0, 0)


class FakeStorage:
    """Records what was deleted; can be told to fail for some paths."""

    def __init__(self, failing=()):
        self.deleted = []
        self.failing = set(failing)

    def delete_file(self, path):
        if path in self.failing:
            return False
        self.deleted.append(path)
        return True


@pytest.fixture
def db():
    reset_sqlite_schema(engine)
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()


def _call(db, *, recorded_days_ago=None, ended_days_ago=None, created_days_ago=0, audio="audio/x.ogg"):
    cs = CallSession(
        astrologer_id=uuid4(),
        livekit_room_name=f"room-{uuid4()}",
        call_status="completed",
        audio_storage_path=audio,
        recording_started_at=NOW - timedelta(days=recorded_days_ago) if recorded_days_ago is not None else None,
        ended_at=NOW - timedelta(days=ended_days_ago) if ended_days_ago is not None else None,
        created_at=NOW - timedelta(days=created_days_ago),
        transcript_text="What we talked about.",
        summary_text="A summary.",
        summary_json={"schema": "1.0"},
    )
    db.add(cs)
    db.commit()
    return cs.id


def _reload(db, call_id):
    db.expire_all()
    return db.query(CallSession).filter(CallSession.id == call_id).one()


def test_the_period_is_six_months():
    assert retention.RECORDING_RETENTION_DAYS == 180
    assert retention.retention_cutoff(NOW) == NOW - timedelta(days=180)


def test_audio_past_six_months_is_deleted_and_the_rest_of_the_session_is_kept(db):
    old = _call(db, recorded_days_ago=181, audio="audio/old.ogg")
    storage = FakeStorage()

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 1

    cs = _reload(db, old)
    assert storage.deleted == ["audio/old.ogg"]
    assert cs.audio_storage_path is None
    assert cs.audio_deleted_at == NOW
    # The reason the recording existed survives it.
    assert cs.transcript_text == "What we talked about."
    assert cs.summary_text == "A summary."
    assert cs.summary_json == {"schema": "1.0"}


def test_audio_inside_six_months_is_left_alone(db):
    recent = _call(db, recorded_days_ago=179, audio="audio/recent.ogg")
    storage = FakeStorage()

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 0

    cs = _reload(db, recent)
    assert storage.deleted == []
    assert cs.audio_storage_path == "audio/recent.ogg"
    assert cs.audio_deleted_at is None


def test_age_falls_back_to_call_end_then_to_creation(db):
    """Older rows can lack recording_started_at; they must still expire, not live forever."""
    by_end = _call(db, ended_days_ago=200, created_days_ago=10, audio="audio/by-end.ogg")
    by_created = _call(db, created_days_ago=365, audio="audio/by-created.ogg")
    storage = FakeStorage()

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 2
    assert sorted(storage.deleted) == ["audio/by-created.ogg", "audio/by-end.ogg"]
    assert _reload(db, by_end).audio_storage_path is None
    assert _reload(db, by_created).audio_storage_path is None


def test_recording_start_wins_over_an_old_creation_date(db):
    """A session created long ago but recorded recently is judged by when it was recorded."""
    kept = _call(db, recorded_days_ago=30, created_days_ago=400, audio="audio/kept.ogg")

    assert retention.purge_expired_recordings(db, now=NOW, storage=FakeStorage()) == 0
    assert _reload(db, kept).audio_storage_path == "audio/kept.ogg"


def test_a_failed_delete_leaves_the_row_untouched_for_the_next_pass(db):
    """Never tell the profile the audio is gone while the file is still in the bucket."""
    stuck = _call(db, recorded_days_ago=190, audio="audio/stuck.ogg")
    fine = _call(db, recorded_days_ago=190, audio="audio/fine.ogg")
    storage = FakeStorage(failing={"audio/stuck.ogg"})

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 1

    assert _reload(db, stuck).audio_storage_path == "audio/stuck.ogg"
    assert _reload(db, stuck).audio_deleted_at is None
    assert _reload(db, fine).audio_storage_path is None

    # Next pass, storage recovered: the leftover goes.
    assert retention.purge_expired_recordings(db, now=NOW, storage=FakeStorage()) == 1
    assert _reload(db, stuck).audio_storage_path is None


def test_storage_down_ends_the_pass_instead_of_spinning(db):
    for i in range(3):
        _call(db, recorded_days_ago=200, audio=f"audio/{i}.ogg")
    everything_fails = FakeStorage(failing={f"audio/{i}.ogg" for i in range(3)})

    assert retention.purge_expired_recordings(db, now=NOW, storage=everything_fails) == 0


def test_a_large_backlog_is_drained_across_batches(db, monkeypatch):
    monkeypatch.setattr(retention, "_BATCH_SIZE", 2)
    for i in range(5):
        _call(db, recorded_days_ago=200 + i, audio=f"audio/{i}.ogg")
    storage = FakeStorage()

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 5
    assert len(storage.deleted) == 5


def test_a_session_that_never_had_audio_is_ignored(db):
    _call(db, recorded_days_ago=400, audio=None)
    storage = FakeStorage()

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 0
    assert storage.deleted == []


def test_running_twice_deletes_nothing_the_second_time(db):
    _call(db, recorded_days_ago=200)
    storage = FakeStorage()

    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 1
    assert retention.purge_expired_recordings(db, now=NOW, storage=storage) == 0
    assert len(storage.deleted) == 1


def test_the_promise_is_written_where_people_read_it():
    """If the job changes its period, these sentences must change with it."""
    import json

    root = os.path.join(os.path.dirname(__file__), "..", "frontend")
    en = json.load(open(os.path.join(root, "locales", "en.json"), encoding="utf-8"))

    assert "six months" in en["page"]["legal"]["privacy"]["s5"]
    assert "six months" in en["page"]["call"]["consent"]["body"]
    assert "six months" in en["page"]["join"]["consent"]["body"]

    page = open(os.path.join(root, "record-astrology-consultations.html"), encoding="utf-8").read()
    assert "How long are recordings kept?" in page
    assert "six months" in page
