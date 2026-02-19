"""Helpers for locale-aware reads from reference dictionaries with en fallback."""
from __future__ import annotations

import re
from typing import Any, Optional

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.i18n.locale import DEFAULT_LOCALE, normalize_locale


_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _ensure_identifier(value: str) -> str:
    if not _IDENTIFIER_RE.match(value):
        raise ValueError(f"Unsafe SQL identifier: {value}")
    return value


class LocalizedReferenceLookup:
    """Utility for robust localized ref lookup with schema variability handling."""

    def __init__(self, session: Session):
        self.session = session
        self._table_exists_cache: dict[str, bool] = {}
        self._column_exists_cache: dict[tuple[str, str], bool] = {}

    def _table_exists(self, table_name: str) -> bool:
        table_name = _ensure_identifier(table_name)
        cached = self._table_exists_cache.get(table_name)
        if cached is not None:
            return cached

        try:
            exists = inspect(self.session.bind).has_table(table_name)
        except Exception:
            exists = False

        self._table_exists_cache[table_name] = exists
        return exists

    def _column_exists(self, table_name: str, column_name: str) -> bool:
        table_name = _ensure_identifier(table_name)
        column_name = _ensure_identifier(column_name)

        cache_key = (table_name, column_name)
        cached = self._column_exists_cache.get(cache_key)
        if cached is not None:
            return cached

        exists = False
        if self._table_exists(table_name):
            try:
                columns = inspect(self.session.bind).get_columns(table_name)
                exists = any(col.get("name") == column_name for col in columns)
            except Exception:
                exists = False

        self._column_exists_cache[cache_key] = exists
        return exists

    def fetch_localized_scalar(
        self,
        *,
        base_table: str,
        key_column: str,
        key_value: Any,
        base_value_column: str,
        i18n_table: str,
        i18n_value_column: str,
        locale: Optional[str],
        fallback_locale: str = DEFAULT_LOCALE,
    ) -> Optional[Any]:
        """Read scalar value from i18n table with fallback to en."""
        base_table = _ensure_identifier(base_table)
        key_column = _ensure_identifier(key_column)
        base_value_column = _ensure_identifier(base_value_column)
        i18n_table = _ensure_identifier(i18n_table)
        i18n_value_column = _ensure_identifier(i18n_value_column)

        if not self._table_exists(base_table):
            return None

        if not self._column_exists(base_table, key_column):
            return None

        if not self._column_exists(base_table, base_value_column):
            return None

        resolved_locale = normalize_locale(locale) or fallback_locale
        resolved_fallback_locale = normalize_locale(fallback_locale) or DEFAULT_LOCALE

        use_i18n = (
            self._table_exists(i18n_table)
            and self._column_exists(i18n_table, key_column)
            and self._column_exists(i18n_table, "locale")
            and self._column_exists(i18n_table, i18n_value_column)
        )

        if use_i18n:
            stmt = text(
                f"""
                SELECT COALESCE(req.{i18n_value_column}, en.{i18n_value_column}) AS value
                FROM {base_table} base
                LEFT JOIN {i18n_table} req
                    ON req.{key_column} = base.{key_column}
                   AND req.locale = :locale
                LEFT JOIN {i18n_table} en
                    ON en.{key_column} = base.{key_column}
                   AND en.locale = :fallback_locale
                WHERE base.{key_column} = :key_value
                LIMIT 1
                """
            )
            return self.session.execute(
                stmt,
                {
                    "locale": resolved_locale,
                    "fallback_locale": resolved_fallback_locale,
                    "key_value": key_value,
                },
            ).scalar()

        stmt = text(
            f"""
            SELECT base.{base_value_column} AS value
            FROM {base_table} base
            WHERE base.{key_column} = :key_value
            LIMIT 1
            """
        )
        return self.session.execute(stmt, {"key_value": key_value}).scalar()
