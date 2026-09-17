"""The arithmetic in the Search Console pull, without touching the network.

The API calls are Google's problem. These are the parts we can get wrong ourselves, and
two of them would quietly flatter the numbers rather than break loudly.
"""
import importlib.util
import json
import os
from datetime import date, timedelta

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "gsc_report",
    os.path.join(os.path.dirname(__file__), "..", "scripts", "gsc_report.py"),
)
gsc_report = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(gsc_report)


def test_window_ends_behind_todays_incomplete_data():
    start, end, previous_start, previous_end = gsc_report.window(28)

    # Ending today would measure a partly finalized day against complete ones and
    # manufacture a drop every single morning.
    assert end == date.today() - timedelta(days=gsc_report.FRESHNESS_LAG_DAYS)
    assert (end - start).days == 27
    assert previous_end == start - timedelta(days=1)
    assert (previous_end - previous_start).days == 27


def test_windows_are_equal_length_and_do_not_overlap():
    start, end, previous_start, previous_end = gsc_report.window(7)

    assert (end - start) == (previous_end - previous_start)
    assert previous_end < start


def test_average_position_is_weighted_by_impressions():
    rows = [
        {"clicks": 0, "impressions": 1000, "position": 30.0},
        {"clicks": 0, "impressions": 1, "position": 1.0},
    ]

    # A plain mean would report 15.5 and make a page-3 site look like a page-2 one.
    assert gsc_report.totals(rows)["position"] == pytest.approx(29.97, abs=0.01)


def test_totals_survive_a_property_with_no_data():
    empty = gsc_report.totals([])

    assert empty == {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0}


def test_ctr_is_clicks_over_impressions():
    rows = [{"clicks": 3, "impressions": 100, "position": 8.0}]

    assert gsc_report.totals(rows)["ctr"] == 0.03


def test_zero_impressions_says_where_to_look_instead_of_printing_an_empty_table():
    report = {
        "site": "sc-domain:steliara.com",
        "window": {"start": "2026-08-21", "end": "2026-09-17", "days": 28},
        "previous_window": {"start": "2026-07-24", "end": "2026-08-20"},
        "totals": {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0},
        "previous_totals": {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0},
        "delta": {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0},
        "by_day": [],
        "top_queries": [],
        "top_pages": [],
    }

    output = gsc_report.render(report)

    assert "Zero impressions" in output
    assert "indexing reason" in output


def test_service_account_can_be_inline_json_or_a_path(tmp_path):
    payload = {"client_email": "bot@example.iam.gserviceaccount.com", "private_key": "x"}

    assert gsc_report.load_service_account(json.dumps(payload)) == payload

    path = tmp_path / "sa.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    assert gsc_report.load_service_account(str(path)) == payload


def test_unconfigured_is_a_clean_exit_not_a_failure(monkeypatch, capsys):
    """So it can be wired into the daily workflow before the credential exists."""
    monkeypatch.delenv("GSC_SERVICE_ACCOUNT", raising=False)

    assert gsc_report.main([]) == 0
    assert "not set" in capsys.readouterr().out


def test_a_broken_credential_fails_loudly(monkeypatch):
    monkeypatch.setenv("GSC_SERVICE_ACCOUNT", "/nonexistent/service-account.json")

    with pytest.raises(SystemExit) as raised:
        gsc_report.main([])

    assert "neither valid JSON nor a readable file" in str(raised.value)


def test_render_reports_the_change_against_the_previous_window():
    report = {
        "site": "sc-domain:steliara.com",
        "window": {"start": "2026-08-21", "end": "2026-09-17", "days": 28},
        "previous_window": {"start": "2026-07-24", "end": "2026-08-20"},
        "totals": {"clicks": 4, "impressions": 900, "ctr": 0.0044, "position": 18.3},
        "previous_totals": {"clicks": 1, "impressions": 120, "ctr": 0.0083, "position": 41.2},
        "delta": {"clicks": 3, "impressions": 780, "ctr": -0.0039, "position": -22.9},
        "by_day": [],
        "top_queries": [{"query": "astrology practice management software",
                         "clicks": 2, "impressions": 300, "position": 7.4}],
        "top_pages": [{"page": "https://www.steliara.com/astrology-practice-management",
                       "clicks": 2, "impressions": 300, "position": 7.4}],
    }

    output = gsc_report.render(report)

    assert "+780" in output
    assert "-22.9" in output
    assert "astrology practice management software" in output


def test_a_long_query_is_truncated_rather_than_breaking_the_column():
    report = {
        "site": "s", "window": {"start": "a", "end": "b", "days": 1},
        "previous_window": {"start": "c", "end": "d"},
        "totals": {"clicks": 1, "impressions": 10, "ctr": 0.1, "position": 5.0},
        "previous_totals": {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0},
        "delta": {"clicks": 1, "impressions": 10, "ctr": 0.1, "position": 5.0},
        "by_day": [], "top_pages": [],
        "top_queries": [{"query": "x" * 200, "clicks": 1, "impressions": 10, "position": 5.0}],
    }

    assert "..." in gsc_report.render(report)
    assert "x" * 200 not in gsc_report.render(report)


def test_the_assertion_we_sign_is_what_google_expects(monkeypatch):
    """The one piece of the OAuth exchange we control: the signed claim set.

    A wrong `aud` or a missing scope fails at Google with an opaque invalid_grant, so it
    is worth pinning here rather than discovering it against the live API.
    """
    import jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    captured = {}

    class _Response:
        def read(self):
            return json.dumps({"access_token": "ya29.fake"}).encode()

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def fake_urlopen(request, **_kwargs):
        captured["url"] = request.full_url
        captured["body"] = dict(
            pair.split("=", 1) for pair in request.data.decode().split("&")
        )
        return _Response()

    monkeypatch.setattr(gsc_report.urllib.request, "urlopen", fake_urlopen)

    token = gsc_report.access_token(
        {"client_email": "bot@example.iam.gserviceaccount.com", "private_key": pem}
    )

    assert token == "ya29.fake"
    assert captured["url"] == gsc_report.TOKEN_URL
    assert captured["body"]["grant_type"] == (
        "urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"
    )

    import urllib.parse
    claims = jwt.decode(
        urllib.parse.unquote(captured["body"]["assertion"]),
        key.public_key(),
        algorithms=["RS256"],
        audience=gsc_report.TOKEN_URL,
    )
    assert claims["iss"] == "bot@example.iam.gserviceaccount.com"
    assert claims["scope"] == gsc_report.SCOPE
    assert claims["exp"] - claims["iat"] == 3600
