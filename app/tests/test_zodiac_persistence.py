from datetime import date, time
from uuid import uuid4

import pytest

from app.tests.api_test_db import create_sqlite_test_session_factory, reset_sqlite_schema
from app.database.models import Astrologer
from app.database.repositories.user_repository import UserRepository


@pytest.fixture()
def session(tmp_path):
    engine, factory = create_sqlite_test_session_factory(str(tmp_path / "zodiac.db"))
    reset_sqlite_schema(engine)
    db = factory()
    try:
        yield db
    finally:
        db.close()


def _astrologer(db):
    astro = Astrologer(id=uuid4(), email=f"{uuid4()}@t.test", password_hash="x")
    db.add(astro)
    db.flush()
    return astro


def test_user_defaults_to_tropical(session):
    astro = _astrologer(session)
    repo = UserRepository(session)
    user = repo.create_user(
        astrologer_id=astro.id, birth_date=date(1990, 6, 26), birth_time=time(9, 0),
        timezone="Europe/Kyiv", birth_place="Kyiv", lat=50.45, lon=30.52, julian_day=2448068.5,
    )
    session.flush()
    fetched = repo.get_user_by_id(user.user_id)
    assert fetched.zodiac == "tropical"
    assert fetched.ayanamsha is None


def test_user_persists_sidereal_choice(session):
    astro = _astrologer(session)
    repo = UserRepository(session)
    user = repo.create_user(
        astrologer_id=astro.id, birth_date=date(1990, 6, 26), birth_time=time(9, 0),
        timezone="Europe/Kyiv", birth_place="Kyiv", lat=50.45, lon=30.52, julian_day=2448068.5,
        zodiac="sidereal", ayanamsha="lahiri",
    )
    session.flush()
    session.expire_all()
    fetched = repo.get_user_by_id(user.user_id)
    assert fetched.zodiac == "sidereal"
    assert fetched.ayanamsha == "lahiri"
