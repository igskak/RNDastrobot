/**
 * Frontend i18n runtime.
 * Exposes window.FrontendI18n in browser and CommonJS exports in Node.
 */
(function (rootFactory) {
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
    const api = rootFactory(root);

    if (typeof window !== 'undefined') {
        window.FrontendI18n = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createI18n: api.createI18n,
            normalizeLocale: api.normalizeLocale,
            parseAcceptLanguage: api.parseAcceptLanguage,
            resolveLocaleFromSources: api.resolveLocaleFromSources,
            SUPPORTED_LOCALES: api.SUPPORTED_LOCALES,
            DEFAULT_LOCALE: api.DEFAULT_LOCALE,
        };
    }
})(function (root) {
    'use strict';

    const SUPPORTED_LOCALES = ['en', 'uk', 'ru'];
    const DEFAULT_LOCALE = 'en';
    const STORAGE_KEY = 'astrobot_locale';
    const DEFAULT_CATALOG_VERSION = 'i18n-v1';

    const BUILTIN_CATALOGS = {
        en: {
            app: {
                language: 'Language',
            },
            common: {
                loading: 'Loading...',
                monthLabel: 'Month',
            },
            locale: {
                name: {
                    en: 'English',
                    uk: 'Ukrainian',
                    ru: 'Russian',
                },
            },
            i18n: {
                loading: 'Loading...',
            },
        },
        uk: {
            app: {
                language: 'Мова',
            },
            common: {
                loading: 'Завантаження...',
                monthLabel: 'Місяць',
            },
            locale: {
                name: {
                    en: 'Англійська',
                    uk: 'Українська',
                    ru: 'Російська',
                },
            },
            i18n: {
                loading: 'Завантаження...',
            },
        },
        ru: {
            app: {
                language: 'Язык',
            },
            common: {
                loading: 'Загрузка...',
                monthLabel: 'Месяц',
            },
            locale: {
                name: {
                    en: 'Английский',
                    uk: 'Украинский',
                    ru: 'Русский',
                },
            },
            i18n: {
                loading: 'Загрузка...',
            },
        },
    };

    function normalizeLocale(rawLocale) {
        if (!rawLocale || typeof rawLocale !== 'string') return null;
        const normalized = rawLocale.trim().toLowerCase().replace(/_/g, '-');
        if (!normalized) return null;
        const base = normalized.split('-', 1)[0];
        return SUPPORTED_LOCALES.includes(base) ? base : null;
    }

    function parseAcceptLanguage(headerValue) {
        if (!headerValue || typeof headerValue !== 'string') return null;

        const weighted = [];
        const chunks = headerValue.split(',');

        for (let i = 0; i < chunks.length; i += 1) {
            const chunk = chunks[i].trim();
            if (!chunk) continue;

            let langPart = chunk;
            let q = 1;

            if (chunk.includes(';')) {
                const parts = chunk.split(';').map((item) => item.trim());
                langPart = parts[0];
                for (let j = 1; j < parts.length; j += 1) {
                    if (!parts[j].toLowerCase().startsWith('q=')) continue;
                    const parsed = Number.parseFloat(parts[j].slice(2));
                    q = Number.isFinite(parsed) ? parsed : 0;
                }
            }

            const normalized = normalizeLocale(langPart);
            if (normalized) {
                weighted.push({ locale: normalized, q, order: i });
            }
        }

        if (!weighted.length) return null;

        weighted.sort((a, b) => {
            if (b.q !== a.q) return b.q - a.q;
            return a.order - b.order;
        });

        return weighted[0].locale;
    }

    function parseQueryLocale(queryString) {
        if (!queryString || typeof queryString !== 'string') return null;
        const query = queryString.startsWith('?') ? queryString.slice(1) : queryString;
        const params = new URLSearchParams(query);
        return normalizeLocale(params.get('locale')) || normalizeLocale(params.get('lang'));
    }

    function resolveLocaleFromSources(sources) {
        const fromQuery = normalizeLocale(sources?.queryLocale);
        if (fromQuery) {
            return { locale: fromQuery, source: 'query' };
        }

        const fromStorage = normalizeLocale(sources?.storedLocale);
        if (fromStorage) {
            return { locale: fromStorage, source: 'storage' };
        }

        const fromBrowser = normalizeLocale(sources?.browserLocale) || parseAcceptLanguage(sources?.acceptLanguage);
        if (fromBrowser) {
            return { locale: fromBrowser, source: 'browser' };
        }

        return { locale: DEFAULT_LOCALE, source: 'default' };
    }

    function getNestedValue(obj, key) {
        if (!obj || typeof obj !== 'object') return undefined;
        const parts = String(key).split('.').filter(Boolean);
        let current = obj;
        for (const part of parts) {
            if (!current || typeof current !== 'object' || !(part in current)) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }

    function interpolate(template, params) {
        if (typeof template !== 'string') return template;
        if (!params || typeof params !== 'object') return template;

        return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_, token) => {
            if (!(token in params)) return `{${token}}`;
            const value = params[token];
            return value === null || value === undefined ? '' : String(value);
        });
    }

    function cloneCatalogs(catalogs) {
        const next = {};
        for (const locale of SUPPORTED_LOCALES) {
            const source = catalogs?.[locale] || {};
            next[locale] = JSON.parse(JSON.stringify(source));
        }
        return next;
    }

    function readCookie(cookieSource, key) {
        if (!cookieSource || typeof cookieSource !== 'string') return null;
        const chunks = cookieSource.split(';').map((item) => item.trim());
        const prefix = `${key}=`;
        const match = chunks.find((item) => item.startsWith(prefix));
        if (!match) return null;
        try {
            return decodeURIComponent(match.slice(prefix.length));
        } catch {
            return match.slice(prefix.length);
        }
    }

    function createI18n(options = {}) {
        const logger = options.logger || console;
        const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        const documentRef = options.document || (typeof document !== 'undefined' ? document : null);
        const navigatorRef = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
        const fetchFn = options.fetchFn || (documentRef && typeof fetch === 'function' ? fetch.bind(root) : null);
        const catalogBasePath = options.catalogBasePath || '/locales';
        const buildId = (
            typeof root?.__APP_BUILD_ID__ === 'string' && root.__APP_BUILD_ID__.trim()
                ? root.__APP_BUILD_ID__.trim()
                : DEFAULT_CATALOG_VERSION
        );

        function withBuildVersion(pathname) {
            const separator = pathname.includes('?') ? '&' : '?';
            return `${pathname}${separator}v=${encodeURIComponent(buildId)}`;
        }

        const state = {
            catalogs: cloneCatalogs(options.catalogs || BUILTIN_CATALOGS),
            warned: new Set(),
            inFlightCatalogLoads: {},
            remoteLoaded: {},
            currentLocale: DEFAULT_LOCALE,
        };

        function scheduleIdleTask(task, timeoutMs = 2000) {
            if (typeof task !== 'function') return;
            if (typeof root.requestIdleCallback === 'function') {
                root.requestIdleCallback(task, { timeout: timeoutMs });
                return;
            }
            setTimeout(task, Math.min(timeoutMs, 500));
        }

        function emitMissingDiagnostic(payload) {
            if (typeof options.onMissing === 'function') {
                try {
                    options.onMissing(payload);
                } catch (error) {
                    logger?.warn?.(`[i18n] diagnostics_callback_failed: ${error.message}`);
                }
            }

            if (!documentRef || typeof CustomEvent !== 'function' || typeof documentRef.dispatchEvent !== 'function') {
                return;
            }

            try {
                documentRef.dispatchEvent(new CustomEvent('frontend:i18n-missing', { detail: payload }));
            } catch {
                // diagnostics should never break runtime
            }
        }

        function warnMissing(kind, locale, key) {
            const marker = `${kind}:${locale}:${key}`;
            if (state.warned.has(marker)) return;
            state.warned.add(marker);
            logger?.warn?.(`[i18n] ${kind} locale="${locale}" key="${key}"`);
            emitMissingDiagnostic({
                kind,
                locale,
                key,
                fallbackLocale: DEFAULT_LOCALE,
            });
        }

        function getStoredLocale() {
            let locale = null;

            if (storage && typeof storage.getItem === 'function') {
                try {
                    locale = storage.getItem(STORAGE_KEY);
                } catch {
                    locale = null;
                }
            }
            if (normalizeLocale(locale)) return locale;

            if (options.cookies && typeof options.cookies.get === 'function') {
                const cookieLocale = options.cookies.get(STORAGE_KEY);
                if (normalizeLocale(cookieLocale)) return cookieLocale;
            }

            const cookieRaw = options.cookieString || documentRef?.cookie;
            const fromCookie = readCookie(cookieRaw, STORAGE_KEY);
            if (normalizeLocale(fromCookie)) return fromCookie;

            return null;
        }

        function getBrowserLocale() {
            const languages = [];

            if (Array.isArray(options.browserLanguages)) {
                languages.push(...options.browserLanguages);
            }
            if (options.browserLocale) {
                languages.push(options.browserLocale);
            }
            if (navigatorRef?.languages?.length) {
                languages.push(...navigatorRef.languages);
            }
            if (navigatorRef?.language) {
                languages.push(navigatorRef.language);
            }

            for (const candidate of languages) {
                const normalized = normalizeLocale(candidate);
                if (normalized) return normalized;
            }

            return null;
        }

        function persistLocale(locale) {
            if (storage && typeof storage.setItem === 'function') {
                try {
                    storage.setItem(STORAGE_KEY, locale);
                } catch {
                    // ignore persistence errors
                }
            }

            if (options.cookies && typeof options.cookies.set === 'function') {
                options.cookies.set(STORAGE_KEY, locale);
            } else if (documentRef) {
                const oneYear = 60 * 60 * 24 * 365;
                documentRef.cookie = `${STORAGE_KEY}=${encodeURIComponent(locale)}; path=/; max-age=${oneYear}; SameSite=Lax`;
            }
        }

        function applyLocaleToDocument(locale = state.currentLocale) {
            if (documentRef?.documentElement) {
                documentRef.documentElement.lang = locale;
            }
        }

        function emitLocaleChanged(locale, source) {
            if (!documentRef || typeof CustomEvent !== 'function') return;
            documentRef.dispatchEvent(new CustomEvent('frontend:locale-changed', {
                detail: {
                    locale,
                    source,
                },
            }));
        }

        async function loadCatalog(locale) {
            const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
            const hasCatalog = state.catalogs[normalized] && Object.keys(state.catalogs[normalized]).length > 0;
            if (hasCatalog && (options.catalogs || state.remoteLoaded[normalized])) {
                return state.catalogs[normalized];
            }
            if (!fetchFn) {
                return state.catalogs[normalized] || {};
            }
            if (state.inFlightCatalogLoads[normalized]) {
                return state.inFlightCatalogLoads[normalized];
            }

            state.inFlightCatalogLoads[normalized] = fetchFn(withBuildVersion(`${catalogBasePath}/${normalized}.json`), {
                headers: { 'Accept': 'application/json' },
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`catalog HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then((data) => {
                    if (data && typeof data === 'object') {
                        state.catalogs[normalized] = data;
                    }
                    state.remoteLoaded[normalized] = true;
                    return state.catalogs[normalized] || {};
                })
                .catch((error) => {
                    logger?.warn?.(`[i18n] failed to load locale "${normalized}": ${error.message}`);
                    state.remoteLoaded[normalized] = true;
                    return state.catalogs[normalized] || {};
                })
                .finally(() => {
                    delete state.inFlightCatalogLoads[normalized];
                });

            return state.inFlightCatalogLoads[normalized];
        }

        function t(key, params) {
            const safeKey = String(key || '');
            if (!safeKey) return '';

            const currentMessage = getNestedValue(state.catalogs[state.currentLocale], safeKey);
            if (currentMessage !== undefined) {
                return interpolate(String(currentMessage), params);
            }

            const fallbackMessage = getNestedValue(state.catalogs[DEFAULT_LOCALE], safeKey);
            if (fallbackMessage !== undefined) {
                warnMissing('missing_translation', state.currentLocale, safeKey);
                return interpolate(String(fallbackMessage), params);
            }

            if (state.currentLocale !== DEFAULT_LOCALE && !state.remoteLoaded[DEFAULT_LOCALE]) {
                scheduleIdleTask(() => {
                    loadCatalog(DEFAULT_LOCALE).catch(() => {
                        // background warmup must stay non-blocking
                    });
                });
            }

            warnMissing('missing_key', state.currentLocale, safeKey);
            return safeKey;
        }

        function getLocale() {
            return state.currentLocale;
        }

        async function setLocale(nextLocale, optionsSet = {}) {
            const normalized = normalizeLocale(nextLocale) || DEFAULT_LOCALE;
            state.currentLocale = normalized;
            applyLocaleToDocument(normalized);

            if (optionsSet.persist !== false) {
                persistLocale(normalized);
            }

            await loadCatalog(normalized);
            if (normalized !== DEFAULT_LOCALE) {
                scheduleIdleTask(() => {
                    loadCatalog(DEFAULT_LOCALE).catch(() => {
                        // background warmup must stay non-blocking
                    });
                });
            }
            emitLocaleChanged(normalized, optionsSet.source || 'setLocale');
            return normalized;
        }

        function withLocaleHeaders(headers = {}) {
            const locale = getLocale();
            return {
                ...headers,
                'Accept-Language': locale,
                'X-Locale': locale,
            };
        }

        function getQueryString() {
            if (typeof options.queryString === 'string') {
                return options.queryString;
            }
            if (typeof location !== 'undefined' && typeof location.search === 'string') {
                return location.search;
            }
            return '';
        }

        function resolveInitialLocale() {
            return resolveLocaleFromSources({
                queryLocale: parseQueryLocale(getQueryString()),
                storedLocale: getStoredLocale(),
                browserLocale: getBrowserLocale(),
                acceptLanguage: navigatorRef?.languages?.join(',') || navigatorRef?.language || null,
            });
        }

        const resolved = resolveInitialLocale();
        state.currentLocale = resolved.locale;
        applyLocaleToDocument(state.currentLocale);

        const ready = loadCatalog(state.currentLocale)
            .catch(() => {
                // best-effort preload should not break bootstrap
            })
            .then(() => {
                if (state.currentLocale !== DEFAULT_LOCALE) {
                    scheduleIdleTask(() => {
                        loadCatalog(DEFAULT_LOCALE).catch(() => {
                            // background warmup must stay non-blocking
                        });
                    });
                }
                emitLocaleChanged(state.currentLocale, 'init');
            });

        return {
            STORAGE_KEY,
            SUPPORTED_LOCALES,
            DEFAULT_LOCALE,
            normalizeLocale,
            parseAcceptLanguage,
            resolveLocaleFromSources,
            createI18n,
            t,
            setLocale,
            getLocale,
            withLocaleHeaders,
            applyLocaleToDocument,
            loadCatalog,
            ready,
        };
    }

    return createI18n();
});
