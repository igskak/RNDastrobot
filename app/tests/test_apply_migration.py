from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database import apply_migration as migration_runner


def test_apply_migration_records_and_skips_replay(tmp_path, monkeypatch):
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    migration_file = migrations_dir / "001_create_example.sql"
    migration_file.write_text("CREATE TABLE example_items (id INTEGER PRIMARY KEY)", encoding="utf-8")

    engine = create_engine(f"sqlite:///{tmp_path / 'migration.sqlite3'}")
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(migration_runner, "MIGRATIONS_DIR", migrations_dir)
    monkeypatch.setattr(migration_runner, "get_db_session", session_factory)

    assert migration_runner.apply_migration(migration_file.name) is True
    assert migration_runner.apply_migration(migration_file.name) is True

    with engine.connect() as connection:
        rows = connection.execute(text("SELECT filename FROM schema_migrations")).fetchall()

    assert rows == [(migration_file.name,)]


def test_migration_status_lists_pending_and_applied(tmp_path, monkeypatch):
    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "001_create_example.sql").write_text("CREATE TABLE example_items (id INTEGER PRIMARY KEY)", encoding="utf-8")
    (migrations_dir / "002_next.sql").write_text("CREATE TABLE second_items (id INTEGER PRIMARY KEY)", encoding="utf-8")
    (migrations_dir / "002_next_down.sql").write_text("DROP TABLE second_items", encoding="utf-8")

    engine = create_engine(f"sqlite:///{tmp_path / 'migration.sqlite3'}")
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(migration_runner, "MIGRATIONS_DIR", migrations_dir)
    monkeypatch.setattr(migration_runner, "get_db_session", session_factory)

    assert migration_runner.apply_migration("001_create_example.sql") is True

    assert migration_runner.migration_status() == [
        ("001_create_example.sql", "applied"),
        ("002_next.sql", "pending"),
    ]
