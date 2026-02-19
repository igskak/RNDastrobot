"""Request-scoped i18n context utilities."""
from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Optional


DEFAULT_LOCALE = "en"


@dataclass(frozen=True)
class LocaleContext:
    """Resolved locale metadata for the current request."""

    locale: str = DEFAULT_LOCALE
    source: str = "default"


_locale_context: ContextVar[LocaleContext] = ContextVar(
    "locale_context",
    default=LocaleContext(),
)


def set_locale_context(context: LocaleContext) -> Token:
    """Set locale context for the current execution context."""
    return _locale_context.set(context)


def reset_locale_context(token: Token) -> None:
    """Reset locale context using token returned by set_locale_context."""
    _locale_context.reset(token)


def get_locale_context() -> LocaleContext:
    """Get current locale context (defaults to en/default)."""
    return _locale_context.get()


def get_current_locale(default: Optional[str] = None) -> str:
    """Get current locale code from context."""
    locale = get_locale_context().locale
    if locale:
        return locale
    return default or DEFAULT_LOCALE
