"""Localized API error contract helpers."""
from __future__ import annotations

from typing import Any, Dict, Optional

from app.i18n.locale import DEFAULT_LOCALE, normalize_locale


STATUS_TO_ERROR_CODE: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    408: "REQUEST_TIMEOUT",
    422: "VALIDATION_ERROR",
    503: "SERVICE_UNAVAILABLE",
    500: "INTERNAL_ERROR",
}


DETAIL_SUBSTRING_TO_CODE: list[tuple[str, str]] = [
    ("некорректный формат user_id", "INVALID_USER_ID"),
    ("invalid user_id format", "INVALID_USER_ID"),
    ("натальная карта для пользователя", "NATAL_CHART_NOT_FOUND"),
    ("natal chart for user", "NATAL_CHART_NOT_FOUND"),
    ("интерпретация", "INTERPRETATION_NOT_FOUND"),
    ("доступ запрещ", "ACCESS_DENIED"),
    ("admin endpoints disabled", "ADMIN_ENDPOINTS_DISABLED"),
    ("пользователь", "USER_NOT_FOUND"),
    ("превышено время ожидания", "GEOCODING_TIMEOUT"),
    ("таймаут", "GEOCODING_TIMEOUT"),
    ("сервис геокодирования временно недоступен", "GEOCODING_UNAVAILABLE"),
]


ERROR_MESSAGES: dict[str, dict[str, str]] = {
    "BAD_REQUEST": {
        "en": "Bad request.",
        "uk": "Некоректний запит.",
        "ru": "Некорректный запрос.",
    },
    "UNAUTHORIZED": {
        "en": "Authentication is required.",
        "uk": "Потрібна автентифікація.",
        "ru": "Требуется аутентификация.",
    },
    "FORBIDDEN": {
        "en": "Access denied.",
        "uk": "Доступ заборонено.",
        "ru": "Доступ запрещен.",
    },
    "NOT_FOUND": {
        "en": "Requested resource was not found.",
        "uk": "Запитаний ресурс не знайдено.",
        "ru": "Запрошенный ресурс не найден.",
    },
    "REQUEST_TIMEOUT": {
        "en": "Request timed out.",
        "uk": "Час очікування запиту вичерпано.",
        "ru": "Превышено время ожидания запроса.",
    },
    "SERVICE_UNAVAILABLE": {
        "en": "Service is temporarily unavailable.",
        "uk": "Сервіс тимчасово недоступний.",
        "ru": "Сервис временно недоступен.",
    },
    "VALIDATION_ERROR": {
        "en": "Validation error.",
        "uk": "Помилка валідації.",
        "ru": "Ошибка валидации.",
    },
    "INTERNAL_ERROR": {
        "en": "Internal server error.",
        "uk": "Внутрішня помилка сервера.",
        "ru": "Внутренняя ошибка сервера.",
    },
    "INVALID_USER_ID": {
        "en": "Invalid user_id format.",
        "uk": "Некоректний формат user_id.",
        "ru": "Некорректный формат user_id.",
    },
    "NATAL_CHART_NOT_FOUND": {
        "en": "Natal chart was not found.",
        "uk": "Натальну карту не знайдено.",
        "ru": "Натальная карта не найдена.",
    },
    "INTERPRETATION_NOT_FOUND": {
        "en": "Interpretation was not found.",
        "uk": "Інтерпретацію не знайдено.",
        "ru": "Интерпретация не найдена.",
    },
    "USER_NOT_FOUND": {
        "en": "User was not found.",
        "uk": "Користувача не знайдено.",
        "ru": "Пользователь не найден.",
    },
    "ACCESS_DENIED": {
        "en": "Access denied.",
        "uk": "Доступ заборонено.",
        "ru": "Доступ запрещен.",
    },
    "ADMIN_ENDPOINTS_DISABLED": {
        "en": "Admin endpoints are disabled.",
        "uk": "Адмін-ендпоінти вимкнені.",
        "ru": "Админ-эндпоинты отключены.",
    },
    "GEOCODING_TIMEOUT": {
        "en": "Geocoding request timed out.",
        "uk": "Час очікування геокодування вичерпано.",
        "ru": "Превышено время ожидания геокодирования.",
    },
    "GEOCODING_UNAVAILABLE": {
        "en": "Geocoding service is temporarily unavailable.",
        "uk": "Сервіс геокодування тимчасово недоступний.",
        "ru": "Сервис геокодирования временно недоступен.",
    },
}


def infer_error_code(status_code: int, detail: Any = None) -> str:
    """Infer stable machine-readable error code from status and detail text."""
    text_value = ""
    if isinstance(detail, str):
        text_value = detail
    elif isinstance(detail, dict):
        nested_detail = detail.get("detail")
        if isinstance(nested_detail, str):
            text_value = nested_detail

    normalized_text = text_value.lower()
    for marker, error_code in DETAIL_SUBSTRING_TO_CODE:
        if marker in normalized_text:
            return error_code

    return STATUS_TO_ERROR_CODE.get(status_code, "INTERNAL_ERROR")


def localize_error_message(error_code: str, locale: Optional[str]) -> str:
    """Get localized message with guaranteed fallback to English."""
    normalized_locale = normalize_locale(locale) or DEFAULT_LOCALE
    translations = ERROR_MESSAGES.get(error_code)

    if not translations:
        fallback = ERROR_MESSAGES["INTERNAL_ERROR"]
        return fallback.get(normalized_locale) or fallback[DEFAULT_LOCALE]

    return (
        translations.get(normalized_locale)
        or translations.get(DEFAULT_LOCALE)
        or ERROR_MESSAGES["INTERNAL_ERROR"][DEFAULT_LOCALE]
    )


def build_error_payload(
    *,
    error_code: str,
    locale: Optional[str],
    detail: Any = None,
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """Build API error payload contract with backward compatible detail."""
    localized_message = localize_error_message(error_code, locale)

    if message and error_code not in ERROR_MESSAGES:
        localized_message = message

    payload: Dict[str, Any] = {
        "error_code": error_code,
        "message": localized_message,
        "detail": detail,
    }

    # Backward compatibility for old clients that looked for `error`.
    payload["error"] = error_code

    return payload
