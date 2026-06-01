/**
 * ForecastSourceUtils — чистые хелперы «точки во времени + места» панели прогностики.
 *
 * Спайк Фазы 0 (план UNIFIED_WORKSPACE_PIVOT_PLAN.md): первый тестируемый шов для будущего
 * извлечения ChartSourcePanel из forecast-new.js (3543 стр.). Вынесена ТОЛЬКО чистая логика
 * (парсинг даты/времени, нормализация таймзоны) — без DOM, без скрытого состояния. Недетерминизм
 * (сегодняшняя дата) и глобалы (window.Timezones) инжектируются параметрами, поэтому всё
 * детерминированно тестируется. forecast-new.js делегирует сюда без изменения поведения.
 */
(function () {
    'use strict';

    function todayIsoDate(now) {
        const d = now instanceof Date ? now : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function normalizeTime(value) {
        const raw = String(value || '12:00:00');
        if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
        if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
        return '12:00:00';
    }

    function splitTargetDatetime(value, fallbackDate) {
        const raw = String(value || '');
        const [date, time = '12:00:00'] = raw.split('T');
        const fallback = fallbackDate || todayIsoDate();
        return [/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback, normalizeTime(time)];
    }

    /**
     * Нормализовать таймзону по списку/угадайке. `timezones` — объект вида window.Timezones
     * { list: [{value}], guess: (s) => value }. Логика идентична forecast-new.js.
     */
    function normalizeTimezoneValue(value, placeName, timezones) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const tz = timezones || {};
        const normalized = (tz.list || []).find((t) => t.value === raw)?.value;
        if (normalized) return normalized;
        const guessedByValue = tz.guess ? tz.guess(raw) : null;
        if (guessedByValue) return guessedByValue;
        const guessedByPlace = tz.guess ? tz.guess(placeName || '') : null;
        if (guessedByPlace) return guessedByPlace;
        return '';
    }

    const api = { todayIsoDate, normalizeTime, splitTargetDatetime, normalizeTimezoneValue };

    if (typeof window !== 'undefined') window.ForecastSourceUtils = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
