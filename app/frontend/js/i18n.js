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
            parseLocaleFromPath: api.parseLocaleFromPath,
            stripLocaleFromPath: api.stripLocaleFromPath,
            localizePath: api.localizePath,
            resolveLocaleFromSources: api.resolveLocaleFromSources,
            SUPPORTED_LOCALES: api.SUPPORTED_LOCALES,
            PREFIXED_LOCALES: api.PREFIXED_LOCALES,
            DEFAULT_LOCALE: api.DEFAULT_LOCALE,
        };
    }
})(function (root) {
    'use strict';

    const SUPPORTED_LOCALES = ['en', 'uk', 'ru', 'de'];
    const DEFAULT_LOCALE = 'en';
    // Locales that live under a URL prefix (/de/pricing.html). The default locale keeps
    // the bare URLs so existing links, ads and search results stay valid.
    const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
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
                    de: 'German',
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
                    de: 'Німецька',
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
                    de: 'Немецкий',
                },
            },
            i18n: {
                loading: 'Загрузка...',
            },
        },
        de: {
            app: {
                language: 'Sprache',
            },
            common: {
                loading: 'Wird geladen...',
                monthLabel: 'Monat',
            },
            locale: {
                name: {
                    en: 'Englisch',
                    uk: 'Ukrainisch',
                    ru: 'Russisch',
                    de: 'Deutsch',
                },
            },
            i18n: {
                loading: 'Wird geladen...',
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
                    q = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
                }
            }

            const normalized = normalizeLocale(langPart);
            if (normalized && q > 0) {
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

    function splitPathSuffix(value) {
        const match = /^([^?#]*)([?#][\s\S]*)?$/.exec(String(value ?? ''));
        let path = match?.[1] || '';
        // Callers pass both site paths ("/pricing.html") and document-relative hrefs
        // ("login.html?mode=register"); both mean the same page here, so normalize.
        if (path && !path.startsWith('/')) path = `/${path}`;
        return { path, suffix: match?.[2] || '' };
    }

    function parseLocaleFromPath(pathname) {
        const { path } = splitPathSuffix(pathname);
        const match = /^\/([A-Za-z]{2})(?=\/|$)/.exec(path);
        if (!match) return null;
        const candidate = match[1].toLowerCase();
        return PREFIXED_LOCALES.includes(candidate) ? candidate : null;
    }

    function stripLocaleFromPath(pathname) {
        const { path, suffix } = splitPathSuffix(pathname);
        const locale = parseLocaleFromPath(path);
        if (!locale) return `${path || '/'}${suffix}`;
        const rest = path.slice(locale.length + 1);
        return `${rest.startsWith('/') ? rest : `/${rest}`}${suffix}`;
    }

    function localizePath(pathname, locale) {
        const bare = stripLocaleFromPath(pathname);
        const { path, suffix } = splitPathSuffix(bare);
        const normalized = normalizeLocale(locale);
        if (!normalized || !PREFIXED_LOCALES.includes(normalized)) {
            return `${path || '/'}${suffix}`;
        }
        const base = path === '/' || path === '' ? `/${normalized}/` : `/${normalized}${path}`;
        return `${base}${suffix}`;
    }

    function resolveLocaleFromSources(sources) {
        // The URL path is the strongest signal: /de/pricing.html is a distinct, indexable
        // document, so it must win over anything this browser remembers.
        const fromPath = normalizeLocale(sources?.pathLocale);
        if (fromPath) {
            return { locale: fromPath, source: 'path' };
        }

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

        /**
         * Records a language choice without re-rendering: the switcher calls this just
         * before navigating to the other locale's URL, so the choice reaches the workspace
         * the visitor signs in to.
         */
        function rememberLocale(nextLocale) {
            const normalized = normalizeLocale(nextLocale);
            if (!normalized) return null;
            persistLocale(normalized);
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

        function getPathname() {
            if (typeof options.pathname === 'string') {
                return options.pathname;
            }
            if (typeof location !== 'undefined' && typeof location.pathname === 'string') {
                return location.pathname;
            }
            return '';
        }

        /**
         * True when this document is one of a set of prerendered translations (it lists
         * them as <link rel="alternate" hreflang>). Such a page is served per locale, so
         * its URL — including the unprefixed English one — defines which language it is,
         * whatever this browser happens to remember.
         */
        function isTranslatedDocument() {
            if (typeof options.translatedDocument === 'boolean') {
                return options.translatedDocument;
            }
            if (!documentRef?.querySelector) return false;
            return !!documentRef.querySelector('link[rel="alternate"][hreflang]');
        }

        function resolveDocumentLocale() {
            return parseLocaleFromPath(getPathname()) || (isTranslatedDocument() ? DEFAULT_LOCALE : null);
        }

        function resolveInitialLocale() {
            return resolveLocaleFromSources({
                pathLocale: resolveDocumentLocale(),
                queryLocale: parseQueryLocale(getQueryString()),
                storedLocale: getStoredLocale(),
                browserLocale: getBrowserLocale(),
                acceptLanguage: navigatorRef?.languages?.join(',') || navigatorRef?.language || null,
            });
        }

        const resolved = resolveInitialLocale();
        state.currentLocale = resolved.locale;
        applyLocaleToDocument(state.currentLocale);

        // A locale asked for by URL (a German ad landing on /de/, a legacy ?lang= link) is an
        // explicit choice: remember it, or the very next in-app navigation drops back to the
        // browser language and the visitor silently leaves the language they arrived in.
        // The bare English URL is deliberately excluded: following one English link should
        // not silently reset the language someone picked for their workspace.
        const askedForByUrl = (
            (resolved.source === 'path' && parseLocaleFromPath(getPathname()))
            || resolved.source === 'query'
        );
        if (askedForByUrl) {
            persistLocale(resolved.locale);
        }

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
            PREFIXED_LOCALES,
            DEFAULT_LOCALE,
            normalizeLocale,
            parseAcceptLanguage,
            parseLocaleFromPath,
            stripLocaleFromPath,
            localizePath,
            resolveLocaleFromSources,
            createI18n,
            t,
            setLocale,
            rememberLocale,
            getLocale,
            withLocaleHeaders,
            applyLocaleToDocument,
            loadCatalog,
            ready,
        };
    }

    return createI18n();
});
