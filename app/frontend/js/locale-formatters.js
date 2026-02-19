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
            return getFormatter('date', Intl.DateTimeFormat, intlOptions).format(date);
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
            return getFormatter('datetime', Intl.DateTimeFormat, optionsWithDefaults).format(date);
        }

        function formatNumber(value, intlOptions = {}) {
            const number = Number(value);
            if (!Number.isFinite(number)) return String(value);
            return getFormatter('number', Intl.NumberFormat, intlOptions).format(number);
        }

        function getCollator(intlOptions = {}) {
            return getFormatter('collator', Intl.Collator, intlOptions);
        }

        return {
            createLocaleFormatters,
            formatDate,
            formatDateTime,
            formatNumber,
            getCollator,
            toIntlLocale,
        };
    }

    return createLocaleFormatters();
});
