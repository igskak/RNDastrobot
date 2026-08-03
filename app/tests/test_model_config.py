"""
Tests for the central model registry.

The default-lock test is the safety contract: these ids MUST equal the values
each agent used before centralization, so migrating a call site changed no
behavior. If someone edits a default, this test makes the behavior change explicit.
"""
import pytest

from app.services.model_config import known_roles, model_for


def test_defaults_match_historical_values(monkeypatch):
    # Ensure no env override leaks in from the environment.
    for env in ("OPENAI_ASSISTANT_MODEL", "OPENAI_JUDGE_MODEL",
                "OPENAI_SUMMARY_MODEL", "OPENAI_TRANSCRIBE_MODEL"):
        monkeypatch.delenv(env, raising=False)
    assert model_for("assistant") == "gpt-5.4-mini"      # was astro_assistant_service._MODEL
    assert model_for("summary") == "gpt-4.1"             # was openai_service._MODEL
    assert model_for("transcribe") == "gpt-4o-transcribe"  # was openai_service._TRANSCRIBE_MODEL
    assert model_for("judge") == "gpt-5.4-mini"          # new (T5)


def test_env_overrides_default(monkeypatch):
    monkeypatch.setenv("OPENAI_ASSISTANT_MODEL", "gpt-x-custom")
    assert model_for("assistant") == "gpt-x-custom"


def test_unknown_role_raises():
    with pytest.raises(ValueError):
        model_for("nonexistent")


def test_known_roles_lists_the_live_agents():
    # "narrative" joins for the §16 Narrative Analyst stage; it ships behind
    # ASSISTANT_NARRATIVE_ENABLED, so the role exists before the stage is on.
    assert set(known_roles()) == {
        "assistant", "judge", "narrative", "summary", "transcribe"}
