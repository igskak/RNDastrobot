"""FastAPI dependency that resolves locale and stores it in request context."""
from __future__ import annotations

from functools import lru_cache
from typing import Optional
from uuid import UUID

from fastapi import Request
from sqlalchemy import inspect, text

from app.database.connection import db_manager
from app.i18n.context import LocaleContext, reset_locale_context, set_locale_context
from app.i18n.locale import (
    extract_user_id_from_request,
    resolve_explicit_locale,
    resolve_locale,
)


_USER_LOCALE_COLUMNS = ("preferred_locale", "locale", "language", "lang")


@lru_cache(maxsize=1)
def _detect_user_locale_columns() -> tuple[str, ...]:
    """Detect locale preference columns in users table once per process."""
    try:
        with db_manager.engine.connect() as connection:
            db_inspector = inspect(connection)
            if not db_inspector.has_table("users"):
                return ()
            columns = {column["name"] for column in db_inspector.get_columns("users")}
    except Exception:
        return ()

    return tuple(column for column in _USER_LOCALE_COLUMNS if column in columns)


def resolve_user_preference_locale(user_id: Optional[UUID]) -> Optional[str]:
    """Read user preferred locale from profile/settings when available."""
    if user_id is None:
        return None

    columns = _detect_user_locale_columns()
    if not columns:
        return None

    locale_column = columns[0]

    try:
        with db_manager.engine.connect() as connection:
            row = connection.execute(
                text(
                    f"""
                    SELECT {locale_column} AS locale_value
                    FROM users
                    WHERE user_id = :user_id
                    LIMIT 1
                    """
                ),
                {"user_id": user_id},
            ).first()
    except Exception:
        return None

    if not row:
        return None

    return row.locale_value


async def locale_context_dependency(request: Request):
    """Resolve locale for request and expose it through request.state + contextvar."""
    explicit_locale = resolve_explicit_locale(request)
    accept_language = request.headers.get("accept-language")

    user_id = await extract_user_id_from_request(request)
    user_locale = resolve_user_preference_locale(user_id)

    resolved = resolve_locale(
        user_preference_locale=user_locale,
        explicit_locale=explicit_locale,
        accept_language=accept_language,
    )

    locale_context = LocaleContext(locale=resolved.locale, source=resolved.source)
    request.state.locale = resolved.locale
    request.state.locale_source = resolved.source
    request.state.locale_context = locale_context

    token = set_locale_context(locale_context)
    try:
        yield
    finally:
        reset_locale_context(token)
