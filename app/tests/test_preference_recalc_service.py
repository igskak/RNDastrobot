from uuid import uuid4

from app.services import preference_recalc_service as recalc_module


def test_prioritize_records_by_user_id_moves_matching_user_first():
    target_user_id = uuid4()
    other_user_id = uuid4()

    class Record:
        def __init__(self, user_id, label):
            self.user_id = user_id
            self.label = label

    records = [
        Record(other_user_id, "first-other"),
        Record(target_user_id, "target-a"),
        Record(other_user_id, "second-other"),
        Record(target_user_id, "target-b"),
    ]

    ordered = recalc_module.prioritize_records_by_user_id(records, target_user_id)

    assert [record.label for record in ordered] == [
        "target-a",
        "target-b",
        "first-other",
        "second-other",
    ]


def test_run_preference_recalc_job_uses_fresh_db_session(monkeypatch):
    job_id = uuid4()
    calls = []

    class DummyDb:
        def close(self):
            calls.append(("close", None))

    class DummyService:
        def __init__(self, db):
            calls.append(("init", db))
            self.db = db

        def process_job(self, received_job_id):
            calls.append(("process", received_job_id))

    db = DummyDb()

    monkeypatch.setattr(recalc_module, "get_db_session", lambda: db)
    monkeypatch.setattr(recalc_module, "PreferenceRecalcService", DummyService)

    recalc_module.run_preference_recalc_job(job_id)

    assert calls == [
        ("init", db),
        ("process", job_id),
        ("close", None),
    ]
