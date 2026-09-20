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
        "de": "Ungültige Anfrage.",
    },
    "UNAUTHORIZED": {
        "en": "Authentication is required.",
        "uk": "Потрібна автентифікація.",
        "ru": "Требуется аутентификация.",
        "de": "Bitte melden Sie sich an.",
    },
    "FORBIDDEN": {
        "en": "Access denied.",
        "uk": "Доступ заборонено.",
        "ru": "Доступ запрещен.",
        "de": "Zugriff verweigert.",
    },
    "NOT_FOUND": {
        "en": "Requested resource was not found.",
        "uk": "Запитаний ресурс не знайдено.",
        "ru": "Запрошенный ресурс не найден.",
        "de": "Der gesuchte Inhalt wurde nicht gefunden.",
    },
    "REQUEST_TIMEOUT": {
        "en": "Request timed out.",
        "uk": "Час очікування запиту вичерпано.",
        "ru": "Превышено время ожидания запроса.",
        "de": (
            "Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut."
        ),
    },
    "SERVICE_UNAVAILABLE": {
        "en": "Service is temporarily unavailable.",
        "uk": "Сервіс тимчасово недоступний.",
        "ru": "Сервис временно недоступен.",
        "de": "Der Dienst ist vorübergehend nicht verfügbar.",
    },
    "VALIDATION_ERROR": {
        "en": "Validation error.",
        "uk": "Помилка валідації.",
        "ru": "Ошибка валидации.",
        "de": "Bitte überprüfen Sie Ihre Eingaben.",
    },
    "INTERNAL_ERROR": {
        "en": "Internal server error.",
        "uk": "Внутрішня помилка сервера.",
        "ru": "Внутренняя ошибка сервера.",
        "de": (
            "Ein technischer Fehler ist aufgetreten. "
            "Bitte versuchen Sie es erneut."
        ),
    },
    "INVALID_USER_ID": {
        "en": "Invalid user_id format.",
        "uk": "Некоректний формат user_id.",
        "ru": "Некорректный формат user_id.",
        "de": "Die Benutzer-ID hat ein ungültiges Format.",
    },
    "NATAL_CHART_NOT_FOUND": {
        "en": "Natal chart was not found.",
        "uk": "Натальну карту не знайдено.",
        "ru": "Натальная карта не найдена.",
        "de": "Das Geburtshoroskop wurde nicht gefunden.",
    },
    "INTERPRETATION_NOT_FOUND": {
        "en": "Interpretation was not found.",
        "uk": "Інтерпретацію не знайдено.",
        "ru": "Интерпретация не найдена.",
        "de": "Die Deutung wurde nicht gefunden.",
    },
    "USER_NOT_FOUND": {
        "en": "User was not found.",
        "uk": "Користувача не знайдено.",
        "ru": "Пользователь не найден.",
        "de": "Das Profil wurde nicht gefunden.",
    },
    "ACCESS_DENIED": {
        "en": "Access denied.",
        "uk": "Доступ заборонено.",
        "ru": "Доступ запрещен.",
        "de": "Zugriff verweigert.",
    },
    "ADMIN_ENDPOINTS_DISABLED": {
        "en": "Admin endpoints are disabled.",
        "uk": "Адмін-ендпоінти вимкнені.",
        "ru": "Админ-эндпоинты отключены.",
        "de": "Die Admin-Schnittstellen sind deaktiviert.",
    },
    "GEOCODING_TIMEOUT": {
        "en": "Geocoding request timed out.",
        "uk": "Час очікування геокодування вичерпано.",
        "ru": "Превышено время ожидания геокодирования.",
        "de": (
            "Die Ortssuche hat zu lange gedauert. "
            "Bitte versuchen Sie es erneut."
        ),
    },
    "GEOCODING_UNAVAILABLE": {
        "en": "Geocoding service is temporarily unavailable.",
        "uk": "Сервіс геокодування тимчасово недоступний.",
        "ru": "Сервис геокодирования временно недоступен.",
        "de": "Die Ortssuche ist vorübergehend nicht verfügbar.",
    },
    "CHART_IMPORT_DISABLED": {
        "en": "Chart import is not available.",
        "uk": "Імпорт карт недоступний.",
        "ru": "Импорт карт недоступен.",
        "de": "Der Horoskopimport ist nicht verfügbar.",
    },
    "EMPTY_IMPORT_FILE": {
        "en": "The selected file is empty.",
        "uk": "Вибраний файл порожній.",
        "ru": "Выбранный файл пуст.",
        "de": "Die ausgewählte Datei ist leer.",
    },
    "IMPORT_FILE_TOO_LARGE": {
        "en": "The file is larger than 5 MiB.",
        "uk": "Файл перевищує 5 МБ.",
        "ru": "Размер файла превышает 5 МБ.",
        "de": "Die Datei ist größer als 5 MiB.",
    },
    "IMPORT_RECORD_TOO_LARGE": {
        "en": "One record in the file is too large.",
        "uk": "Один запис у файлі завеликий.",
        "ru": "Одна запись в файле слишком большая.",
        "de": "Ein Eintrag in der Datei ist zu groß.",
    },
    "IMPORT_TOO_MANY_RECORDS": {
        "en": "The file contains more than 2,000 records.",
        "uk": "Файл містить понад 2000 записів.",
        "ru": "Файл содержит больше 2000 записей.",
        "de": "Die Datei enthält mehr als 2.000 Einträge.",
    },
    "UNSUPPORTED_IMPORT_FORMAT": {
        "en": "This file format is not supported.",
        "uk": "Цей формат файла не підтримується.",
        "ru": "Этот формат файла не поддерживается.",
        "de": "Dieses Dateiformat wird nicht unterstützt.",
    },
    "UNSUPPORTED_FILE_ENCODING": {
        "en": "The file text encoding could not be read.",
        "uk": "Не вдалося прочитати кодування файла.",
        "ru": "Не удалось прочитать кодировку файла.",
        "de": "Die Textkodierung der Datei konnte nicht gelesen werden.",
    },
    "NOT_AN_AAF_FILE": {
        "en": "The text file does not contain AAF records.",
        "uk": "Текстовий файл не містить записів AAF.",
        "ru": "Текстовый файл не содержит записей AAF.",
        "de": "Die Textdatei enthält keine AAF-Einträge.",
    },
    "IMPORT_PARSE_FAILED": {
        "en": "The file could not be read.",
        "uk": "Не вдалося прочитати файл.",
        "ru": "Не удалось прочитать файл.",
        "de": "Die Datei konnte nicht gelesen werden.",
    },
    "IMPORT_NOT_FOUND": {
        "en": "The import was not found.",
        "uk": "Імпорт не знайдено.",
        "ru": "Импорт не найден.",
        "de": "Der Import wurde nicht gefunden.",
    },
    "IMPORT_EXPIRED": {
        "en": "This preview has expired. Upload the file again.",
        "uk": "Термін попереднього перегляду минув. Завантажте файл знову.",
        "ru": "Срок предпросмотра истёк. Загрузите файл снова.",
        "de": (
            "Diese Vorschau ist abgelaufen. "
            "Laden Sie die Datei erneut hoch."
        ),
    },
    "IMPORT_ALREADY_STARTED": {
        "en": "This import has already started.",
        "uk": "Цей імпорт уже розпочато.",
        "ru": "Этот импорт уже начат.",
        "de": "Dieser Import wurde bereits gestartet.",
    },
    "IMPORT_SELECTION_EMPTY": {
        "en": "Select at least one record.",
        "uk": "Виберіть щонайменше один запис.",
        "ru": "Выберите хотя бы одну запись.",
        "de": "Wählen Sie mindestens einen Eintrag aus.",
    },
    "IMPORT_ITEM_NOT_FOUND": {
        "en": "An import record was not found.",
        "uk": "Запис імпорту не знайдено.",
        "ru": "Запись импорта не найдена.",
        "de": "Ein Importeintrag wurde nicht gefunden.",
    },
    "IMPORT_ITEM_NOT_READY": {
        "en": "One or more selected records cannot be imported.",
        "uk": "Один або кілька вибраних записів неможливо імпортувати.",
        "ru": "Одну или несколько выбранных записей нельзя импортировать.",
        "de": (
            "Mindestens ein ausgewählter Eintrag kann nicht importiert werden."
        ),
    },
    "IMPORT_WARNING_NOT_ACKNOWLEDGED": {
        "en": "Review and confirm the selected warnings.",
        "uk": "Перегляньте й підтвердьте попередження.",
        "ru": "Проверьте и подтвердите предупреждения.",
        "de": "Prüfen und bestätigen Sie die Hinweise.",
    },
    "PROFILE_NOT_FOUND": {
        "en": "The selected profile was not found.",
        "uk": "Вибраний профіль не знайдено.",
        "ru": "Выбранный профиль не найден.",
        "de": "Das ausgewählte Profil wurde nicht gefunden.",
    },
    "PROFILE_NAME_REQUIRED": {
        "en": "Enter a name for the new profile.",
        "uk": "Введіть назву нового профілю.",
        "ru": "Введите название нового профиля.",
        "de": "Geben Sie einen Namen für das neue Profil ein.",
    },
    "IMPORT_CONFIGURATION_CONFLICT": {
        "en": "The settings of a started import cannot be changed.",
        "uk": "Налаштування розпочатого імпорту не можна змінити.",
        "ru": "Настройки начатого импорта нельзя изменить.",
        "de": (
            "Die Einstellungen eines gestarteten Imports "
            "können nicht geändert werden."
        ),
    },
    "IMPORT_ITEM_NOT_SELECTED": {
        "en": "This record is not selected for import.",
        "uk": "Цей запис не вибрано для імпорту.",
        "ru": "Эта запись не выбрана для импорта.",
        "de": "Dieser Eintrag ist nicht für den Import ausgewählt.",
    },
    "INVALID_HOUSE_SYSTEM": {
        "en": "The selected house system is not supported.",
        "uk": "Вибрана система будинків не підтримується.",
        "ru": "Выбранная система домов не поддерживается.",
        "de": "Das gewählte Häusersystem wird nicht unterstützt.",
    },
    "IMPORT_DESTINATION_INVALID": {
        "en": "The selected import destination is invalid.",
        "uk": "Вибране місце імпорту некоректне.",
        "ru": "Выбрано некорректное место импорта.",
        "de": "Das gewählte Importziel ist ungültig.",
    },
    "PLAN_LIMIT_REACHED": {
        "en": "Your saved chart limit has been reached.",
        "uk": "Досягнуто ліміт збережених карт.",
        "ru": "Достигнут лимит сохранённых карт.",
        "de": "Das Limit gespeicherter Horoskope ist erreicht.",
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
