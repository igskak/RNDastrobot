"""Localized, deterministic assistant reply fragments."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.i18n.locale import DEFAULT_LOCALE, normalize_locale


@lru_cache(maxsize=1)
def _catalog():
    path = Path(__file__).resolve().parent.parent / "i18n" / "catalogs" / "assistant.json"
    return json.loads(path.read_text(encoding="utf-8"))


def reply_text(locale):
    return _catalog()[normalize_locale(locale) or DEFAULT_LOCALE]
