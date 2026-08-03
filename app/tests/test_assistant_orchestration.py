"""PR6 — orchestration: stage budgets, continuation, boundary calibration, grounding."""
import pytest

import app.services.astro_assistant_service as svc
from app.services.astro_assistant_service import (
    MAX_ANSWER_TOKENS,
    MAX_COMPLETION_TOKENS,
    MAX_TOOL_ITERATIONS,
    _continuation_instruction,
    _is_affirmative,
    _pending_offer,
)
from app.services.astro_judge import _JUDGE_SYSTEM
from app.services.astro_provenance import unsupported_dates


# --- stage budgets ------------------------------------------------------------

def test_answer_budget_is_larger_than_the_compact_budget():
    """300 tokens cannot hold an overview, cluster structure, a monthly table and
    a ranked top-10. A survey that took real compute came back as a fragment."""
    assert MAX_ANSWER_TOKENS > MAX_COMPLETION_TOKENS
    assert MAX_ANSWER_TOKENS >= 1200


def test_compact_budget_is_unchanged_for_short_stages():
    assert MAX_COMPLETION_TOKENS == 300


def test_iteration_cap_is_unchanged():
    """The owner's decision keeps 5 iterations; only the token ceiling moved."""
    assert MAX_TOOL_ITERATIONS == 5


def test_answering_calls_use_the_answer_budget(monkeypatch):
    """Every completion that can produce a FINAL answer must get the large
    ceiling — the loop exit, the iteration-cap exit and the judge regeneration."""
    import inspect
    source = inspect.getsource(svc)
    assert "max_completion_tokens=MAX_COMPLETION_TOKENS" not in source
    assert source.count("max_completion_tokens=MAX_ANSWER_TOKENS") == 3


# --- continuation (spec Gap G) ------------------------------------------------

@pytest.mark.parametrize("text", [
    "Давай", "давайте", "Да", "ок", "Окей", "поехали", "продолжай",
    "yes", "Go ahead", "do it", "sure", "Start",
])
def test_affirmatives_are_recognised(text):
    assert _is_affirmative(text)


@pytest.mark.parametrize("text", [
    "Давай транзиты Плутона",          # carries its own request
    "да, но только по Урану",
    "нет",
    "А что насчёт Нептуна?",
    "",
])
def test_non_bare_agreements_are_not_treated_as_continuation(text):
    assert not _is_affirmative(text)


def test_bare_agreement_after_an_offer_resumes_it():
    """The observed beta failure: the assistant offered slow-planet transits for
    a stated window, the astrologer said 'Давай', and the assistant answered as
    though the conversation had just begun — refusing, because the bare word
    carried no request of its own."""
    messages = [
        {"role": "user", "content": "Проанализируй карту"},
        {"role": "assistant", "content":
            "Если хотите, могу начать с транзитов медленных планет "
            "за 2026-07-02 → 2028-07-02."},
        {"role": "user", "content": "Давай"},
    ]
    instruction = _continuation_instruction(messages)
    assert instruction is not None
    assert "2026-07-02" in instruction          # the offer is quoted back
    assert "do not re-ask" in instruction.lower()


def test_agreement_without_a_preceding_offer_is_not_a_continuation():
    messages = [
        {"role": "assistant", "content": "Плутон квадрат Солнце: вход 2027-01-10."},
        {"role": "user", "content": "Давай"},
    ]
    assert _pending_offer(messages) is None
    assert _continuation_instruction(messages) is None


def test_two_user_turns_running_break_the_offer_chain():
    messages = [
        {"role": "assistant", "content": "Могу показать транзиты за год."},
        {"role": "user", "content": "подожди"},
        {"role": "user", "content": "давай"},
    ]
    assert _pending_offer(messages) is None


def test_continuation_instruction_is_absent_for_a_normal_request():
    messages = [{"role": "user", "content": "Транзиты Урана на два года"}]
    assert _continuation_instruction(messages) is None


# --- boundary calibration (spec §20) -------------------------------------------

def test_judge_is_told_to_judge_claims_not_vocabulary():
    """The beta transcript shows the assistant refusing an explicitly data-level
    request because it contained the word 'analyze'."""
    assert "Judge the CLAIM, never the vocabulary" in _JUDGE_SYSTEM
    for word in ("analysis", "forecast", "future", "period", "important",
                 "significant", "career", "money", "health"):
        assert word in _JUDGE_SYSTEM


def test_judge_keeps_blocking_real_interpretation():
    """Calibration must not become permission."""
    assert "will strain your career" in _JUDGE_SYSTEM
    assert "BLOCK: 'Mars square Saturn is a hard aspect that brings tension.'" in _JUDGE_SYSTEM
    assert "brings tension" in _JUDGE_SYSTEM


def test_judge_contract_is_still_one_word():
    assert _JUDGE_SYSTEM.rstrip().endswith("ALLOW or BLOCK.")


# --- deterministic grounding ---------------------------------------------------

def test_iso_date_absent_from_tool_results_is_flagged():
    tool_results = [{"result": {"contacts": [{"enter": "2027-01-10T00:00:00+02:00"}]}}]
    reply = "Вход 2027-01-10, точно 2027-06-30."
    assert unsupported_dates(reply, tool_results) == ["2027-06-30"]


def test_grounded_dates_produce_no_finding():
    tool_results = [{"result": {"passes": [{"date": "2027-06-30T08:00:00+02:00"}]}}]
    assert unsupported_dates("Точно 2027-06-30.", tool_results) == []


def test_non_iso_dates_are_not_flagged():
    """A rendering like 'март 2027' could faithfully describe a real value;
    flagging it would be noise, not a catch."""
    assert unsupported_dates("Пик приходится на март 2027 года.", []) == []


def test_reply_without_dates_is_cheap_and_clean():
    assert unsupported_dates("Луна — самая аспектированная точка.", []) == []


def test_grounding_reports_rather_than_blocks():
    """Blocking before the false-positive rate is known would trade a rare
    fabrication for a common wrongly-refused answer. The beta has already been
    bitten once by a guardrail firing on valid replies."""
    import inspect
    source = inspect.getsource(svc)
    assert '"unsupported_dates": unsupported_dates(' in source
    # It must not feed the guardrail verdict.
    assert "blocked_unsupported_date" not in source
