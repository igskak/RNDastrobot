"""Moon letters: lunations and houses, the letter text, double opt-in, signed links, the journal, sending."""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_moon_api_test.db")

from app.api.main import app  # noqa: E402
from app.api.routes import moon_journal as moon_routes  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import MoonJournalEntry, MoonSubscriber  # noqa: E402
from app.services import b2c_safety_policy as safety  # noqa: E402
from app.services import moon_journal_service as moon  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, make_get_db_override, reset_sqlite_schema  # noqa: E402

BIRTH = {"date": "1990-05-17", "time": "14:30", "timezone": "Europe/Warsaw", "latitude": 52.23, "longitude": 21.01}
SECRET = "unit-test-moon-secret-0123456789"
CRON = "unit-test-moon-cron-0123456789"
NEW_MOON_NOV_2026 = datetime(2026, 11, 9, 7, 2, 7)
LUNATIONS_JSON = Path(__file__).resolve().parents[1] / "frontend" / "moon-src" / "lunations.json"


@pytest.fixture
def db_factory(tmp_path):
    engine, factory = create_sqlite_test_session_factory(str(tmp_path / "moon.db"))
    reset_sqlite_schema(engine)
    app.dependency_overrides[get_db] = make_get_db_override(factory)
    yield factory
    app.dependency_overrides.pop(get_db, None)
    engine.dispose()


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    for dependency in (moon_routes._calc_limit, moon_routes._subscribe_limit, moon_routes._token_limit):
        dependency.limiter._hits.clear()


@pytest.fixture
def client(db_factory):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("MOON_LINK_SECRET", SECRET)
    monkeypatch.setenv("MOON_CRON_SECRET", CRON)
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://example.test")


@pytest.fixture
def sent(monkeypatch):
    outbox = []
    monkeypatch.setattr(
        "app.auth.mailer.send_transactional_email",
        lambda *, recipient, subject, body_text, **_: outbox.append((recipient, subject, body_text)) or True,
    )
    return outbox


def _token_from(body: str) -> str:
    return re.search(r"\?t=([A-Za-z0-9_\-]+)", body).group(1)


# --- sky -------------------------------------------------------------------------------

def test_lunations_match_the_published_times():
    lunations = moon.lunations_from(datetime(2026, 10, 1), 4)
    assert [lun.kind for lun in lunations] == ["new_moon", "full_moon", "new_moon", "full_moon"]
    new_moon = lunations[2]
    assert abs((new_moon.utc - NEW_MOON_NOV_2026).total_seconds()) < 120
    assert moon.content("en")["signs"][new_moon.sign] == "Scorpio"


def test_latest_lunation_is_never_in_the_future():
    now = datetime(2026, 11, 9, 12)
    latest = moon.latest_lunation(now)
    assert latest.kind == "new_moon" and latest.utc <= now
    assert moon.latest_lunation(datetime(2026, 11, 9, 6)).kind == "full_moon"


def test_houses_count_from_the_rising_sign_or_the_sun():
    rising = moon.natal_frame(date(1990, 5, 17), (14, 30), "Europe/Warsaw", 52.23, 21.01)
    assert rising == moon.Frame("rising", 5)  # Virgo rising
    solar = moon.natal_frame(date(1990, 5, 17), None, "Europe/Warsaw", None, None)
    assert solar == moon.Frame("sun", 1)  # Sun in Taurus
    # A time without a place cannot give a rising sign either.
    assert moon.natal_frame(date(1990, 5, 17), (14, 30), "Europe/Warsaw", None, None).mode == "sun"
    assert rising.house_of(7) == 3 and solar.house_of(1) == 1 and solar.house_of(0) == 12


def test_committed_lunation_table_matches_the_ephemeris():
    table = json.loads(LUNATIONS_JSON.read_text(encoding="utf-8"))["lunations"]
    assert len(table) >= 26
    fresh = moon.lunations_from(datetime.fromisoformat(table[0]["utc"][:-1]) - timedelta(hours=1), 3)
    for row, lun in zip(table, fresh):
        assert row["kind"] == lun.kind and row["sign"] == lun.sign
        assert row["utc"] == lun.utc.isoformat() + "Z"


# --- text ------------------------------------------------------------------------------

def _shape(node):
    if isinstance(node, dict):
        return {k: _shape(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_shape(v) for v in node]
    return None


def test_every_language_has_the_same_blocks():
    english = _shape(moon.content("en"))
    for locale in moon.LOCALES:
        c = moon.content(locale)
        assert _shape(c) == english, locale
        assert len(c["houses"]) == 12 and len(c["signs"]) == 12 and len(c["signs_in"]) == 12
        needs = {"confirm_body": "{link}", "write": "{link}", "link_body": "{link}", "footer": "{manage_link}"}
        for key, needed in needs.items():
            assert needed in c["email"][key], (locale, key)
        assert "{house}" in c["headline"] and "{sign_in}" in c["email"]["subject"]


def test_english_letters_obey_the_safety_law():
    c = moon.content("en")
    texts = [c["disclaimer"], *c["frame"].values(), *c["universal"].values()]
    for block in c["houses"]:
        texts += [block["theme"], block["affirmation"], *block["new"], *block["full"]]
    for text in texts:
        assert safety.is_safe(text, "en"), (text, safety.find_violations(text, "en"))


@pytest.mark.parametrize("locale", moon.LOCALES)
def test_letter_for_every_house_and_language(locale):
    lun = moon.lunations_from(datetime(2026, 11, 1), 1)[0]
    for first_sign in range(12):
        data = moon.letter(lun, moon.Frame("sun", first_sign), locale, "Europe/Warsaw")
        assert 1 <= data["house"] <= 12 and len(data["prompts"]) == 3
        assert str(data["house"]) in data["headline"]


# --- free calculator -------------------------------------------------------------------

@pytest.mark.parametrize("locale", moon.LOCALES)
def test_chart_endpoint(client, locale):
    response = client.post("/api/v1/moon/chart", json={"birth": BIRTH, "locale": locale})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["frame"] == "rising"
    assert [lun["kind"] for lun in body["lunations"]] == ["new_moon", "full_moon"]


@pytest.mark.parametrize("patch", [
    {"date": "1850-01-01"}, {"time": "25:00"}, {"timezone": "Nowhere/Land"},
    {"latitude": 52.2, "longitude": None}, {"latitude": 95, "longitude": 10},
])
def test_chart_rejects_bad_birth_data(client, patch):
    response = client.post("/api/v1/moon/chart", json={"birth": dict(BIRTH, **patch)})
    assert response.status_code == 422


# --- signup and the letter page -------------------------------------------------------

def _subscribe(client, **overrides):
    body = {"birth": BIRTH, "email": "Ola@Example.com", "locale": "pl", "consent": True, "place_label": "Warszawa"}
    body.update(overrides)
    return client.post("/api/v1/moon/subscribe", json=body)


def test_signup_is_off_without_a_link_secret(client, sent, monkeypatch):
    monkeypatch.delenv("MOON_LINK_SECRET", raising=False)
    assert _subscribe(client).status_code == 503
    assert sent == []


def test_signup_needs_consent(client, env, sent):
    assert _subscribe(client, consent=False).status_code == 422


def test_double_opt_in_flow(client, env, sent, db_factory):
    assert _subscribe(client).json() == {"status": "check_inbox"}
    assert len(sent) == 1
    recipient, subject, body = sent[0]
    assert recipient == "ola@example.com" and subject == moon.content("pl")["email"]["confirm_subject"]
    assert "https://example.test/moon/pl/letter?t=" in body and "&confirm=1" in body
    token = _token_from(body)

    # Asking again at once neither duplicates the row nor sends a second email.
    assert _subscribe(client).status_code == 200
    assert len(sent) == 1
    with db_factory() as db:
        assert db.query(MoonSubscriber).count() == 1
        assert db.query(MoonSubscriber).one().status == "pending"

    page = client.post("/api/v1/moon/letter", json={"token": token, "confirm": True}).json()
    assert page["status"] == "confirmed" and page["locale"] == "pl"
    assert page["current"]["kind"] in moon.KINDS and page["next"]["house"] in range(1, 13)
    assert page["interested"] is False

    # Confirmed: a new signup with the same address only refreshes the data, quietly.
    assert _subscribe(client, locale="de").status_code == 200
    assert len(sent) == 1
    with db_factory() as db:
        sub = db.query(MoonSubscriber).one()
        assert sub.locale == "de" and sub.opens == 1 and sub.confirmed_at is not None


def test_interest_unsubscribe_and_erase(client, env, sent, db_factory):
    _subscribe(client)
    token = _token_from(sent[0][2])
    client.post("/api/v1/moon/letter", json={"token": token, "confirm": True})

    assert client.post("/api/v1/moon/interest", json={"token": token}).status_code == 200
    assert client.post("/api/v1/moon/letter", json={"token": token}).json()["interested"] is True
    assert client.post("/api/v1/moon/unsubscribe", json={"token": token}).json() == {"status": "unsubscribed"}
    with db_factory() as db:
        sub = db.query(MoonSubscriber).one()
        assert sub.status == "unsubscribed" and sub.journal_interest_at is not None

    assert client.post("/api/v1/moon/erase", json={"token": token}).json() == {"status": "erased"}
    with db_factory() as db:
        assert db.query(MoonSubscriber).count() == 0
    assert client.post("/api/v1/moon/letter", json={"token": token}).status_code == 404


def _confirmed_token(client, sent):
    _subscribe(client)
    token = _token_from(sent[-1][2])
    page = client.post("/api/v1/moon/letter", json={"token": token, "confirm": True}).json()
    return token, page["current"]


def _save(client, token, current, index=0, answer="Read one book", **extra):
    body = {"token": token, "lunation_utc": current["utc"], "kind": current["kind"], "index": index,
            "question": current["prompts"][index % len(current["prompts"])], "answer": answer}
    body.update(extra)
    return client.post("/api/v1/moon/journal/save", json=body)


def test_journal_answers_are_kept_on_the_server(client, env, sent, db_factory):
    token, current = _confirmed_token(client, sent)
    assert _save(client, token, current).json() == {"status": "saved"}
    assert _save(client, token, current, index=2, answer="Rest, my sister, the project").status_code == 200
    assert _save(client, token, current, answer="Read two books").status_code == 200  # an edit, not a new row

    page = client.post("/api/v1/moon/letter", json={"token": token}).json()
    group = page["journal"][0]
    assert group["utc"] == current["utc"] and group["kind"] == current["kind"]
    assert group["label"].startswith(moon.content("pl")["kinds"][current["kind"]])
    assert [(e["index"], e["answer"]) for e in group["entries"]] == [(0, "Read two books"), (2, "Rest, my sister, the project")]
    assert group["entries"][0]["question"] == current["prompts"][0]

    assert _save(client, token, current, answer="  ").status_code == 200  # emptied: removed
    with db_factory() as db:
        assert db.query(MoonJournalEntry).count() == 1


def test_journal_refuses_unconfirmed_and_odd_input(client, env, sent):
    _subscribe(client)
    token = _token_from(sent[0][2])
    current = client.post("/api/v1/moon/letter", json={"token": token}).json()["current"]
    assert _save(client, token, current).status_code == 403  # pending: confirm first
    client.post("/api/v1/moon/letter", json={"token": token, "confirm": True})
    assert _save(client, token, current, lunation_utc="2019-01-01T00:00:00Z").status_code == 422
    assert _save(client, token, current, kind="eclipse").status_code == 422
    assert _save(client, token, current, index=12).status_code == 422
    assert _save(client, token, current, answer="x" * 5001).status_code == 422


def test_erase_removes_the_journal_too(client, env, sent, db_factory):
    token, current = _confirmed_token(client, sent)
    _save(client, token, current)
    assert client.post("/api/v1/moon/erase", json={"token": token}).status_code == 200
    with db_factory() as db:
        assert db.query(MoonJournalEntry).count() == 0 and db.query(MoonSubscriber).count() == 0


def test_send_me_my_link(client, env, sent, db_factory):
    # Unknown address: same answer, nothing sent.
    assert client.post("/api/v1/moon/link", json={"email": "nobody@example.com"}).json() == {"status": "check_inbox"}
    assert sent == []

    token, _ = _confirmed_token(client, sent)
    with db_factory() as db:  # the confirmation was just sent; let the throttle window pass
        db.query(MoonSubscriber).update({MoonSubscriber.confirm_sent_at: datetime.utcnow() - timedelta(hours=1)})
        db.commit()
    assert client.post("/api/v1/moon/link", json={"email": "OLA@example.com"}).status_code == 200
    recipient, subject, body = sent[-1]
    assert recipient == "ola@example.com" and subject == moon.content("pl")["email"]["link_subject"]
    assert _token_from(body) == token and "confirm=1" not in body

    # A second request inside the window sends nothing more.
    count = len(sent)
    client.post("/api/v1/moon/link", json={"email": "ola@example.com"})
    assert len(sent) == count


def test_forged_token_is_refused(client, env, sent):
    _subscribe(client)
    token = _token_from(sent[0][2])
    forged = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    assert client.post("/api/v1/moon/letter", json={"token": forged}).status_code == 404


# --- sending --------------------------------------------------------------------------

def _confirmed(db_factory, email="a@example.com", status="confirmed", **kwargs):
    with db_factory() as db:
        sub = MoonSubscriber(
            email=email, locale=kwargs.pop("locale", "en"), birth_date=date(1990, 5, 17),
            birth_time=datetime(1990, 5, 17, 14, 30).time(), timezone="Europe/Warsaw", latitude=52.23, longitude=21.01,
            status=status, consent_at=datetime.utcnow(), confirmed_at=datetime.utcnow() if status == "confirmed" else None,
            **kwargs,
        )
        db.add(sub)
        db.commit()
        return sub.id


def test_letters_go_once_per_lunation_to_confirmed_subscribers(env, sent, db_factory):
    _confirmed(db_factory, "a@example.com")
    _confirmed(db_factory, "b@example.com", locale="fr")
    _confirmed(db_factory, "c@example.com", status="pending")
    _confirmed(db_factory, "d@example.com", status="unsubscribed")
    lun = moon.latest_lunation(NEW_MOON_NOV_2026 + timedelta(hours=1))

    with db_factory() as db:
        result = moon.send_due_letters(db, now=lun.utc + timedelta(hours=1))
        db.commit()
    assert result["sent"] == 2 and result["failed"] == 0
    assert sorted(r for r, _, _ in sent) == ["a@example.com", "b@example.com"]
    subject, body = next((s, b) for r, s, b in sent if r == "a@example.com")
    assert subject == "New Moon in Scorpio: your house 3"
    assert "1. " in body and "/moon/letter?t=" in body and "#manage" in body
    french = next(s for r, s, _ in sent if r == "b@example.com")
    assert french.startswith("Nouvelle Lune en Scorpion")

    with db_factory() as db:
        assert moon.send_due_letters(db, now=lun.utc + timedelta(hours=5))["sent"] == 0
        assert {s.letters_sent for s in db.query(MoonSubscriber).filter(MoonSubscriber.status == "confirmed")} == {1}


def test_nothing_goes_out_for_an_old_lunation(env, sent, db_factory):
    _confirmed(db_factory)
    lun = moon.latest_lunation(NEW_MOON_NOV_2026 + timedelta(hours=1))
    with db_factory() as db:
        assert moon.send_due_letters(db, now=lun.utc + timedelta(hours=40)) == {"sent": 0, "failed": 0, "lunation": None}
    assert sent == []


def test_scheduler_and_stats_hide_behind_the_cron_secret(client, env, sent, db_factory):
    _confirmed(db_factory)
    assert client.post("/api/v1/moon/internal/send-letters").status_code == 404
    assert client.get("/api/v1/moon/internal/stats", headers={"X-Moon-Cron": "wrong"}).status_code == 404
    response = client.post("/api/v1/moon/internal/send-letters", headers={"X-Moon-Cron": CRON})
    assert response.status_code == 200 and "sent" in response.json()
    stats = client.get("/api/v1/moon/internal/stats", headers={"X-Moon-Cron": CRON}).json()
    assert stats["by_locale"]["en"]["signups"] == 1 and stats["by_locale"]["en"]["confirmed"] == 1
    assert stats["by_locale"]["en"]["writers"] == 0 and stats["by_locale"]["en"]["entries"] == 0


# --- product events (PostHog) ----------------------------------------------------------

@pytest.fixture
def events(monkeypatch):
    sent_events = []
    monkeypatch.setenv("POSTHOG_PROJECT_API_KEY", "phc_test_key")
    monkeypatch.setattr("app.analytics.posthog._dispatch", sent_events.append)
    return sent_events


def _names(events):
    return [(e["event"], e["properties"].get("locale")) for e in events]


def test_page_views_are_counted_without_identifying_anyone(client, events):
    human = {"User-Agent": "Mozilla/5.0 (iPhone) Safari/604.1", "Referer": "https://www.google.com/search?q=neumond"}
    assert client.get("/moon/de", headers=human).status_code == 200
    assert client.get("/moon", headers={"User-Agent": "Mozilla/5.0 Macintosh"}).status_code == 200
    assert client.get("/moon/pl/letter", headers=human).status_code == 200
    for bot in ("Googlebot/2.1 (+http://www.google.com/bot.html)", "curl/8.4.0", "Mozilla/5.0 HeadlessChrome", ""):
        client.get("/moon/fr", headers={"User-Agent": bot})
    assert client.get("/moon/nonsense", headers=human).status_code == 404

    assert _names(events) == [("moon.page_view", "de"), ("moon.page_view", "en"), ("moon.page_view", "pl")]
    first = events[0]["properties"]
    assert first["page"] == "index" and first["referrer_host"] == "google.com"
    assert events[1]["properties"]["referrer_host"] == "direct" and events[2]["properties"]["page"] == "letter"
    for event in events:
        props = event["properties"]
        assert props["$process_person_profile"] is False and props["$geoip_disable"] is True
        assert len(event["distinct_id"]) == 32 and "token" not in json.dumps(event).lower().replace("api_key", "")
    assert len({e["distinct_id"] for e in events}) == 3  # no visitor can be followed across events


def test_nothing_is_sent_without_a_project_key(client, monkeypatch):
    sent_events = []
    monkeypatch.delenv("POSTHOG_PROJECT_API_KEY", raising=False)
    monkeypatch.setattr("app.analytics.posthog._dispatch", sent_events.append)
    client.get("/moon/de", headers={"User-Agent": "Mozilla/5.0"})
    assert sent_events == []


def test_the_whole_journey_is_visible_in_the_events(client, env, sent, events, db_factory):
    client.post("/api/v1/moon/chart", json={"birth": BIRTH, "locale": "pl"})
    _subscribe(client)
    token = _token_from(sent[0][2])
    current = client.post("/api/v1/moon/letter", json={"token": token, "confirm": True}).json()["current"]
    _save(client, token, current)
    _save(client, token, current, answer="Read two books")  # an edit, not a new answer
    client.post("/api/v1/moon/interest", json={"token": token})
    client.post("/api/v1/moon/interest", json={"token": token})  # counted once
    client.post("/api/v1/moon/unsubscribe", json={"token": token})
    client.post("/api/v1/moon/erase", json={"token": token})

    assert _names(events) == [
        ("moon.chart_calculated", "pl"), ("moon.signup_requested", "pl"), ("moon.confirmed", "pl"),
        ("moon.journal_entry", "pl"), ("moon.interest_clicked", "pl"), ("moon.unsubscribed", "pl"),
        ("moon.erased", "pl"),
    ]
    serialized = json.dumps(events)
    for private in ("ola@example.com", "1990-05-17", "Read one book", "Read two books", "Warszawa", token):
        assert private not in serialized


def test_letters_and_links_are_counted(env, sent, events, db_factory, client):
    _confirmed(db_factory, "a@example.com", locale="de")
    lun = moon.latest_lunation(NEW_MOON_NOV_2026 + timedelta(hours=1))
    with db_factory() as db:
        moon.send_due_letters(db, now=lun.utc + timedelta(hours=1))
        db.commit()
    assert _names(events) == [("moon.letter_sent", "de")]
    assert events[0]["properties"]["kind"] == lun.kind
