"""The ops gate. This route returns other tenants' emails and feedback, so the
allowlist is the entire security argument — it gets tested harder than the payload."""
import pytest

from app.api.routes import ops


class _Astrologer:
    def __init__(self, email):
        self.email = email


class _Auth:
    def __init__(self, email):
        self.astrologer = _Astrologer(email)


def _require(monkeypatch, allowlist, email):
    monkeypatch.setenv("OPS_OWNER_EMAILS", allowlist)
    return ops._require_owner(_Auth(email))


# --- closed by default ---------------------------------------------------------

def test_unset_allowlist_locks_everyone_out(monkeypatch):
    """Merging this file must expose nothing. An unset variable is 'off', never
    'no restriction' — the inverted reading is how ops routes leak."""
    monkeypatch.delenv("OPS_OWNER_EMAILS", raising=False)
    with pytest.raises(Exception) as exc:
        ops._require_owner(_Auth("owner@example.com"))
    assert exc.value.status_code == 404


def test_empty_and_whitespace_allowlist_locks_everyone_out(monkeypatch):
    for value in ("", "   ", ",", " , , "):
        with pytest.raises(Exception) as exc:
            _require(monkeypatch, value, "owner@example.com")
        assert exc.value.status_code == 404, value


# --- who gets through ----------------------------------------------------------

def test_listed_owner_passes(monkeypatch):
    assert _require(monkeypatch, "owner@example.com", "owner@example.com") == \
        "owner@example.com"


def test_match_ignores_case_and_padding(monkeypatch):
    """A real allowlist is hand-edited in a dashboard field; casing and stray
    spaces are the normal state of such a value, not an edge case."""
    assert _require(monkeypatch, " Owner@Example.COM , other@x.io ",
                    "OWNER@example.com") == "owner@example.com"


def test_second_entry_in_the_list_passes(monkeypatch):
    assert _require(monkeypatch, "a@x.io,b@x.io", "b@x.io") == "b@x.io"


# --- who does not --------------------------------------------------------------

def test_unlisted_account_is_refused(monkeypatch):
    with pytest.raises(Exception) as exc:
        _require(monkeypatch, "owner@example.com", "stranger@example.com")
    assert exc.value.status_code == 404


def test_refusal_is_404_not_403(monkeypatch):
    """403 would confirm both that the route exists and that there is a list to
    get onto. The refusal must be indistinguishable from a missing route."""
    with pytest.raises(Exception) as exc:
        _require(monkeypatch, "owner@example.com", "stranger@example.com")
    assert exc.value.status_code == 404
    assert "owner" not in str(exc.value.detail).lower()


def test_missing_or_blank_email_is_refused(monkeypatch):
    """An account with no email must not collide with a malformed allowlist entry
    and pass by accident."""
    monkeypatch.setenv("OPS_OWNER_EMAILS", "owner@example.com")
    for bad in (None, "", "   "):
        auth = _Auth(bad)
        with pytest.raises(Exception) as exc:
            ops._require_owner(auth)
        assert exc.value.status_code == 404, bad


def test_substring_of_a_listed_email_does_not_pass(monkeypatch):
    """Matching must be on whole entries, never containment."""
    for attacker in ("wner@example.com", "owner@example.como", "x+owner@example.com"):
        with pytest.raises(Exception) as exc:
            _require(monkeypatch, "owner@example.com", attacker)
        assert exc.value.status_code == 404, attacker


# --- the route offers no query surface -----------------------------------------

def test_route_takes_no_free_text_parameters():
    """This is an ops view, not a remote SQL console. If a string parameter ever
    appears here, that distinction is gone — fail loudly at that moment."""
    import inspect
    import typing

    sig = inspect.signature(ops.ops_overview)
    caller_supplied = {"days", "limit"}
    assert set(sig.parameters) - {"db", "auth"} == caller_supplied
    # The module uses `from __future__ import annotations`, so read resolved
    # hints rather than the raw strings.
    hints = typing.get_type_hints(ops.ops_overview)
    for name in caller_supplied:
        assert hints[name] is int, name
