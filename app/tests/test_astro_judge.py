"""
Tests for the Layer-3 interpretation judge.

The LLM path uses a scripted fake client. The heuristic screen is cross-checked
against the single-source seed examples: it must catch every FORBIDDEN example
and pass every ALLOWED example (no false positive on real technical data).
"""
from types import SimpleNamespace

import pytest

from app.services.astro_boundary import ALLOWED_EXAMPLES, FORBIDDEN_EXAMPLES
from app.services.astro_judge import (
    VERDICT_ALLOW,
    VERDICT_BLOCK,
    classify_reply,
    heuristic_interpretation,
)


class _FakeClient:
    def __init__(self, content, raises=False):
        self._content = content
        self._raises = raises
        self.calls = []

    class _Chat:
        def __init__(self, outer):
            self.completions = outer

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self._raises:
            raise RuntimeError("judge provider down")
        msg = SimpleNamespace(content=self._content)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    @property
    def chat(self):
        return _FakeClient._Chat(self)


def test_classify_block_when_judge_says_block():
    client = _FakeClient("BLOCK")
    assert classify_reply("This means conflict.", client=client, model="m") == VERDICT_BLOCK


def test_classify_allow_when_judge_says_allow():
    client = _FakeClient("ALLOW")
    assert classify_reply("Mars square Saturn, orb 0.9°.", client=client, model="m") == VERDICT_ALLOW


def test_classify_is_robust_to_case_and_extra_text():
    assert classify_reply("x", client=_FakeClient("block."), model="m") == VERDICT_BLOCK
    assert classify_reply("x", client=_FakeClient(" Allow"), model="m") == VERDICT_ALLOW


def test_classify_defaults_to_allow_only_on_explicit_non_block():
    # An empty/garbled judge response is treated as ALLOW here; the caller's
    # fail-closed-soft path handles ERRORS (exceptions), not ambiguous content.
    assert classify_reply("x", client=_FakeClient(""), model="m") == VERDICT_ALLOW


def test_classify_propagates_provider_error():
    with pytest.raises(RuntimeError):
        classify_reply("x", client=_FakeClient(None, raises=True), model="m")


def test_judge_uses_the_given_model():
    client = _FakeClient("ALLOW")
    classify_reply("x", client=client, model="judge-model-42")
    assert client.calls[0]["model"] == "judge-model-42"


# ── heuristic screen vs the single-source seed examples ───────────────────────
def test_heuristic_catches_every_forbidden_seed():
    missed = [ex for ex in FORBIDDEN_EXAMPLES if not heuristic_interpretation(ex)]
    assert missed == [], f"heuristic missed forbidden examples: {missed}"


def test_heuristic_passes_every_allowed_seed():
    tripped = [ex for ex in ALLOWED_EXAMPLES if heuristic_interpretation(ex)]
    assert tripped == [], f"heuristic false-positived on allowed data: {tripped}"


def test_heuristic_empty_is_clean():
    assert heuristic_interpretation("") is False
    assert heuristic_interpretation(None) is False
