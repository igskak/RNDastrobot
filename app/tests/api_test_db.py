from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import JSON, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, sessionmaker

from app.database.models import Base


def prepare_sqlite_metadata_for_tests() -> None:
    """Make PostgreSQL JSONB columns compilable for SQLite-backed API tests."""
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, JSONB):
                column.type = JSON()


def create_sqlite_test_session_factory(database_path: str):
    prepare_sqlite_metadata_for_tests()
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, session_factory


def reset_sqlite_schema(engine) -> None:
    prepare_sqlite_metadata_for_tests()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def make_get_db_override(session_factory):
    def _override_get_db() -> Iterator[Session]:
        db = session_factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return _override_get_db
