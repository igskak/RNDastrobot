"""PR1 — methodology provenance + computed/effective override schema."""
from pathlib import Path
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
from app.services.astro_provenance import (
    attach_provenance,
    build_methodology_provenance,
    overridable,
)


class _StubRuntime:
    """Minimal PreferencesRuntimeResolver stand-in.

    build_methodology_provenance only ever calls these four; stubbing keeps the
    test on the provenance logic instead of the whole preferences stack.
    """

    def __init__(self, *, astrologer_id=None, hash_value="abc123", threshold=5.0,
                 signs=None, default_signs=None, explode=False):
        self._astrologer_id = astrologer_id
        self._hash = hash_value
        self._threshold = threshold
        self._signs = signs or {}
        self._default_signs = default_signs or {}
        self._explode = explode

    def get_astrologer_id_for_user(self, user_id):
        if self._explode:
            raise RuntimeError("boom")
        return self._astrologer_id

    def get_methodology_hash_for_user(self, user_id, *, default_house_system="P"):
        return self._hash

    def get_stationary_threshold_for_user(self, user_id, *, default_house_system="P"):
        return self._threshold

    def get_dignity_settings_for_astrologer(self, astrologer_id, *, default_house_system="P"):
        return {"signs": self._signs}

    def build_default_methodology(self):
        return {"dignities": {"signs": self._default_signs}}


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


# --- criterion 1: migration is idempotent ------------------------------------

def test_migration_055_is_idempotent_and_nullable():
    """Guards the re-run safety the migration promises.

    Structural rather than executed: the statements are Postgres-specific
    (SQLite has no ADD COLUMN IF NOT EXISTS), and prod is Postgres.
    """
    sql = Path("app/database/migrations/055_add_assistant_turn_provenance.sql").read_text()
    assert sql.count("IF NOT EXISTS") >= 3  # 2 columns + 1 index
    assert "methodology_hash" in sql and "resolved_settings" in sql
    # Nullable => backfill-safe. A NOT NULL on either COLUMN would break existing
    # rows; the partial index's "IS NOT NULL" predicate is fine, so scope the
    # check to the ALTER TABLE statement.
    alter = sql.upper().split("ALTER TABLE", 1)[1].split(";", 1)[0]
    assert "NOT NULL" not in alter


# --- criterion 5: overridable() shapes ---------------------------------------

def test_overridable_without_override_mirrors_computed():
    out = overridable("natal_house", 1)
    assert out["computed_value"] == 1
    assert out["effective_value"] == 1
    assert out["override_applied"] is False
    assert out["override_type"] is None
    assert out["override_source"] is None


def test_overridable_with_override_preserves_computed():
    out = overridable("natal_house", 1, 2, source="astrologer", reason="working methodology")
    assert out["computed_value"] == 1        # never destroyed
    assert out["effective_value"] == 2
    assert out["override_applied"] is True
    assert out["override_type"] == "manual"
    assert out["override_source"] == "astrologer"
    assert out["override_reason"] == "working methodology"


def test_overridable_same_value_is_not_an_override():
    """effective == computed must not masquerade as a manual override."""
    out = overridable("natal_house", 3, 3)
    assert out["override_applied"] is False


# --- criteria 3-4: provenance resolution + attachment ------------------------

def test_provenance_carries_hash_and_resolved_settings():
    prov = build_methodology_provenance(
        _StubRuntime(astrologer_id=uuid4(), hash_value="deadbeef", threshold=7.5),
        uuid4(),
    )
    assert prov["methodology_hash"] == "deadbeef"
    settings = prov["resolved_settings"]
    assert settings["orb_profile"] == "prognostic"
    assert settings["orb_source"] == "astrologer_settings"
    assert settings["stationary_threshold_percent"] == 7.5
    assert settings["house_system"] == "P"


def test_provenance_marks_default_orb_source_without_astrologer():
    prov = build_methodology_provenance(_StubRuntime(astrologer_id=None), uuid4())
    assert prov["resolved_settings"]["orb_source"] == "default"
    assert prov["resolved_settings"]["rulership"]["source"] == "default"


def test_provenance_changes_when_methodology_changes():
    """Criterion 3: editing settings must produce a different fingerprint."""
    uid = uuid4()
    before = build_methodology_provenance(_StubRuntime(hash_value="hash-v1"), uid)
    after = build_methodology_provenance(_StubRuntime(hash_value="hash-v2"), uid)
    assert before["methodology_hash"] != after["methodology_hash"]


def test_provenance_counts_customized_rulership_signs():
    prov = build_methodology_provenance(
        _StubRuntime(
            astrologer_id=uuid4(),
            signs={"Aries": {"ruler": "Pluto"}, "Taurus": {"ruler": "Venus"}},
            default_signs={"Aries": {"ruler": "Mars"}, "Taurus": {"ruler": "Venus"}},
        ),
        uuid4(),
    )
    rulership = prov["resolved_settings"]["rulership"]
    assert rulership["customized_signs"] == 1
    assert rulership["source"] == "astrologer_settings"


def test_provenance_never_raises_into_the_turn():
    """Audit metadata must not fail a turn whose numbers are correct."""
    prov = build_methodology_provenance(_StubRuntime(explode=True), uuid4())
    assert prov["methodology_hash"] is None
    assert prov["resolved_settings"] is None


def test_attach_provenance_preserves_existing_dataset_hash():
    """Layer-1 facets carry their own provenance; we add, never overwrite."""
    result = {"status": "ok", "provenance": {"dataset": "ce07affaa3d3"}}
    out = attach_provenance(result, {"methodology_hash": "abc", "resolved_settings": {}})
    assert out["provenance"]["dataset"] == "ce07affaa3d3"
    assert out["provenance"]["methodology_hash"] == "abc"


def test_attach_provenance_is_a_noop_on_non_dict_or_empty():
    assert attach_provenance("not a dict", {"methodology_hash": "x"}) == "not a dict"
    assert attach_provenance({"status": "ok"}, None) == {"status": "ok"}


# --- criterion 2: persisted on the turn --------------------------------------

def test_log_turn_persists_methodology_provenance():
    db = _session()
    astrologer_id = uuid4()
    conv_id, metric_id = log_turn(
        db,
        astrologer_id=astrologer_id,
        chart_user_id=uuid4(),
        conversation_id=None,
        user_message="на год",
        assistant_reply="...",
        metrics={"model": "gpt-5.4-mini"},
        max_iterations_reached=False,
        methodology_hash="abc123",
        resolved_settings={"orb_profile": "prognostic", "house_system": "P"},
    )
    assert metric_id is not None
    metric = db.query(AssistantTurnMetric).filter_by(id=metric_id).one()
    assert metric.methodology_hash == "abc123"
    assert metric.resolved_settings["orb_profile"] == "prognostic"


def test_log_turn_without_provenance_still_works():
    """Backfill safety: a turn that resolved no methodology must still persist."""
    db = _session()
    _, metric_id = log_turn(
        db,
        astrologer_id=uuid4(),
        chart_user_id=uuid4(),
        conversation_id=None,
        user_message="hi",
        assistant_reply="...",
        metrics={},
        max_iterations_reached=False,
    )
    metric = db.query(AssistantTurnMetric).filter_by(id=metric_id).one()
    assert metric.methodology_hash is None
