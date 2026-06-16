from sqlalchemy import inspect

from app.tests.api_test_db import create_sqlite_test_session_factory, reset_sqlite_schema


def test_sqlite_api_test_schema_contains_cross_route_tables(tmp_path):
    db_path = tmp_path / "api_schema.sqlite3"
    engine, _session_factory = create_sqlite_test_session_factory(str(db_path))

    reset_sqlite_schema(engine)

    tables = set(inspect(engine).get_table_names())
    assert "users" in tables
    assert "persons" in tables
    assert "person_chart_links" in tables
    assert "call_sessions" in tables
    assert "billing_subscriptions" in tables
