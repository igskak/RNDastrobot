/**
 * Locale-aware Intl helpers.
 * Exposes window.LocaleFormatters in browser and CommonJS exports in Node.
 */
(function (factory) {
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
    const api = factory(root);

    if (typeof window !== 'undefined') {
        window.LocaleFormatters = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createLocaleFormatters: api.createLocaleFormatters,
            formatDate: api.formatDate,
            formatDateTime: api.formatDateTime,
            formatAstroCoordinate: api.formatAstroCoordinate,
        };
    }
})(function (root) {
    'use strict';

    function toIntlLocale(locale) {
        if (locale === 'uk') return 'uk-UA';
        if (locale === 'ru') return 'ru-RU';
        return 'en-US';
    }

    function stableKey(prefix, locale, options) {
        return `${prefix}:${locale}:${JSON.stringify(options || {})}`;
    }

    function getVisualPreferences() {
        return root?.AstroPreferences?.getAccountVisualPreferences?.() || {};
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function formatDateByPreference(date, locale, intlOptions = {}) {
        const dateFormat = root?.AstroPreferences?.getDateFormat?.(getVisualPreferences()) || 'DD_MM_YYYY';
        if (dateFormat === 'LOCALE') {
            return new Intl.DateTimeFormat(locale, intlOptions).format(date);
        }

        const day = pad2(date.getDate());
        const month = pad2(date.getMonth() + 1);
        const year = String(date.getFullYear());
        let datePart = `${day}.${month}.${year}`;

        if (dateFormat === 'MM_DD_YYYY') {
            datePart = `${month}/${day}/${year}`;
        } else if (dateFormat === 'YYYY_MM_DD') {
            datePart = `${year}-${month}-${day}`;
        }

        if (intlOptions?.hour || intlOptions?.minute || intlOptions?.second) {
            const timeOptions = { ...intlOptions };
            delete timeOptions.day;
            delete timeOptions.month;
            delete timeOptions.year;
            delete timeOptions.weekday;
            delete timeOptions.era;
            const timeFormatter = new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit',
                ...timeOptions,
            });
            return `${datePart} ${timeFormatter.format(date)}`;
        }

        return datePart;
    }

    function createLocaleFormatters(options = {}) {
        const cache = new Map();

        const getLocale = typeof options.getLocale === 'function'
            ? options.getLocale
            : () => (root?.FrontendI18n?.getLocale?.() || 'en');

        function getFormatter(prefix, ctor, intlOptions) {
            const locale = toIntlLocale(getLocale());
            const key = stableKey(prefix, locale, intlOptions);
            if (cache.has(key)) return cache.get(key);
            const formatter = new ctor(locale, intlOptions);
            cache.set(key, formatter);
            return formatter;
        }

        function formatDate(value, intlOptions = {}) {
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            const locale = toIntlLocale(getLocale());
            return formatDateByPreference(date, locale, intlOptions);
        }

        function formatDateTime(value, intlOptions = {}) {
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);

            const optionsWithDefaults = {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                ...intlOptions,
            };
            const locale = toIntlLocale(getLocale());
            return formatDateByPreference(date, locale, optionsWithDefaults);
        }

        function formatNumber(value, intlOptions = {}) {
            const number = Number(value);
            if (!Number.isFinite(number)) return String(value);
            return getFormatter('number', Intl.NumberFormat, intlOptions).format(number);
        }

        function getCollator(intlOptions = {}) {
            return getFormatter('collator', Intl.Collator, intlOptions);
        }

        function formatAstroCoordinate(input = {}, options = {}) {
            const payload = typeof input === 'object' && input !== null
                ? input
                : { degree_in_sign: input };
            const degree = Number(payload.degree_in_sign ?? payload.degreeInSign ?? payload.degree);
            if (!Number.isFinite(degree)) return options.emptyValue ?? '';

            const degrees = Math.floor(degree);
            const minuteFloat = (degree - degrees) * 60;
            const minutes = Math.max(0, Math.min(59, Math.floor(minuteFloat)));
            const secondFloat = (minuteFloat - minutes) * 60;
            const seconds = Math.max(0, Math.min(59, Math.floor(secondFloat)));
            const sign = payload.sign || options.sign || '';
            const signSymbol = options.signSymbol
                || root?.Symbols?.signs?.[sign]
                || sign;
            const degreeFormat = String(
                options.degreeFormat
                || root?.AstroPreferences?.getDegreeFormat?.(getVisualPreferences())
                || 'DEGREES_ONLY'
            ).trim().toUpperCase();

            if (degreeFormat === 'DEGREES_MINUTES') {
                return [
                    `${degrees}°`,
                    signSymbol,
                    `${String(minutes).padStart(2, '0')}'`,
                ].filter(Boolean).join(' ');
            }

            if (degreeFormat === 'DEGREES_MINUTES_SECONDS') {
                return [
                    `${degrees}°`,
                    signSymbol,
                    `${String(minutes).padStart(2, '0')}'`,
                    `${String(seconds).padStart(2, '0')}"`,
                ].filter(Boolean).join(' ');
            }

            return [
                `${degrees}°`,
                signSymbol,
            ].filter(Boolean).join(' ');
        }

        return {
            createLocaleFormatters,
            formatDate,
            formatDateTime,
            formatNumber,
            formatAstroCoordinate,
            getCollator,
            toIntlLocale,
        };
    }

    return createLocaleFormatters();
});
