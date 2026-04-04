const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createI18n,
    resolveLocaleFromSources,
} = require('../frontend/js/i18n.js');

function makeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return map.has(key) ? map.get(key) : null;
        },
        setItem(key, value) {
            map.set(key, String(value));
        },
        removeItem(key) {
            map.delete(key);
        },
    };
}

function makeDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const TEST_CATALOGS = {
    en: {
        app: { language: 'Language' },
        msg: {
            hello: 'Hello, {name}!',
            only_en: 'Only English',
        },
    },
    uk: {
        app: { language: 'Мова' },
        msg: {
            hello: 'Привіт, {name}!',
        },
    },
    ru: {
        app: { language: 'Язык' },
    },
};

test('setLocale/getLocale persists locale and falls back to en on invalid locale', async () => {
    const writes = [];
    const storage = makeStorage();
    const i18n = createI18n({
        catalogs: TEST_CATALOGS,
        storage,
        cookies: {
            get() {
                return null;
            },
            set(key, value) {
                writes.push([key, value]);
            },
        },
        browserLocale: 'ru-RU',
        fetchFn: null,
    });

    assert.equal(i18n.getLocale(), 'ru');

    await i18n.setLocale('uk');
    assert.equal(i18n.getLocale(), 'uk');
    assert.equal(storage.getItem('astrobot_locale'), 'uk');
    assert.deepEqual(writes[0], ['astrobot_locale', 'uk']);

    await i18n.setLocale('de');
    assert.equal(i18n.getLocale(), 'en');
});

test('locale source priority uses query > storage > browser > en', () => {
    const resolvedFromQuery = resolveLocaleFromSources({
        queryLocale: 'ru',
        storedLocale: 'uk',
        browserLocale: 'en-US',
    });
    assert.deepEqual(resolvedFromQuery, { locale: 'ru', source: 'query' });

    const resolvedFromStorage = resolveLocaleFromSources({
        queryLocale: 'de',
        storedLocale: 'uk',
        browserLocale: 'ru-RU',
    });
    assert.deepEqual(resolvedFromStorage, { locale: 'uk', source: 'storage' });

    const resolvedFromBrowser = resolveLocaleFromSources({
        queryLocale: null,
        storedLocale: null,
        browserLocale: 'ru-RU',
    });
    assert.deepEqual(resolvedFromBrowser, { locale: 'ru', source: 'browser' });

    const fallback = resolveLocaleFromSources({
        queryLocale: 'de',
        storedLocale: 'it',
        browserLocale: 'fr-FR',
    });
    assert.deepEqual(fallback, { locale: 'en', source: 'default' });
});

test('createI18n applies source priority from query/localStorage/browser', () => {
    const fromQuery = createI18n({
        catalogs: TEST_CATALOGS,
        storage: makeStorage({ astrobot_locale: 'uk' }),
        queryString: '?locale=ru',
        browserLocale: 'en-US',
        fetchFn: null,
    });
    assert.equal(fromQuery.getLocale(), 'ru');

    const fromStorage = createI18n({
        catalogs: TEST_CATALOGS,
        storage: makeStorage({ astrobot_locale: 'uk' }),
        queryString: '?locale=de',
        browserLocale: 'ru-RU',
        fetchFn: null,
    });
    assert.equal(fromStorage.getLocale(), 'uk');

    const fromBrowser = createI18n({
        catalogs: TEST_CATALOGS,
        storage: makeStorage(),
        queryString: '',
        browserLocale: 'ru-RU',
        fetchFn: null,
    });
    assert.equal(fromBrowser.getLocale(), 'ru');
});

test('FrontendI18n.ready resolves after initial preload and emits init source once preload completes', async () => {
    const restoreCustomEvent = globalThis.CustomEvent;
    const events = [];
    const pendingCatalogs = {
        en: makeDeferred(),
        uk: makeDeferred(),
    };

    globalThis.CustomEvent = class {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    };

    try {
        const i18n = createI18n({
            catalogs: { en: {}, uk: {}, ru: {} },
            queryString: '?locale=uk',
            document: {
                documentElement: { lang: 'en' },
                dispatchEvent(event) {
                    events.push(event);
                },
            },
            fetchFn: async (url) => {
                if (url.includes('/en.json')) {
                    return pendingCatalogs.en.promise;
                }
                if (url.includes('/uk.json')) {
                    return pendingCatalogs.uk.promise;
                }
                throw new Error(`Unexpected locale request: ${url}`);
            },
        });

        assert.ok(i18n.ready && typeof i18n.ready.then === 'function');
        assert.equal(events.filter((event) => event.type === 'frontend:locale-changed').length, 0);

        pendingCatalogs.en.resolve({
            ok: true,
            async json() {
                return { app: { language: 'Language' } };
            },
        });
        await Promise.resolve();
        assert.equal(events.filter((event) => event.type === 'frontend:locale-changed').length, 0);

        pendingCatalogs.uk.resolve({
            ok: true,
            async json() {
                return { app: { language: 'Мова' } };
            },
        });

        await i18n.ready;

        const localeEvents = events.filter((event) => event.type === 'frontend:locale-changed');
        assert.equal(localeEvents.length, 1);
        assert.equal(localeEvents[0].detail.locale, 'uk');
        assert.equal(localeEvents[0].detail.source, 'init');
    } finally {
        globalThis.CustomEvent = restoreCustomEvent;
    }
});

test('createI18n uses absolute /locales path by default for remote catalogs', async () => {
    const requestedUrls = [];

    const i18n = createI18n({
        catalogs: { en: {}, uk: {}, ru: {} },
        queryString: '?locale=uk',
        fetchFn: async (url) => {
            requestedUrls.push(url);
            return {
                ok: true,
                async json() {
                    return { app: { language: 'Test' } };
                },
            };
        },
    });

    await i18n.ready;

    assert.ok(requestedUrls.some((url) => url.startsWith('/locales/uk.json')));
});

test('t() falls back to en for missing key in active locale and interpolates params', async () => {
    const warnings = [];
    const i18n = createI18n({
        catalogs: TEST_CATALOGS,
        logger: {
            warn(message) {
                warnings.push(message);
            },
        },
        queryString: '?locale=uk',
        fetchFn: null,
    });

    assert.equal(i18n.getLocale(), 'uk');
    assert.equal(i18n.t('msg.hello', { name: 'Ihor' }), 'Привіт, Ihor!');
    assert.equal(i18n.t('msg.only_en'), 'Only English');

    assert.equal(i18n.t('msg.not_exists'), 'msg.not_exists');
    assert.ok(warnings.some((w) => w.includes('missing_translation') && w.includes('msg.only_en')));
    assert.ok(warnings.some((w) => w.includes('missing_key') && w.includes('msg.not_exists')));
});

test('runtime diagnostics emit callback/event for missing translation keys without breaking fallback', () => {
    const diagnostics = [];
    const events = [];
    const originalCustomEvent = globalThis.CustomEvent;

    globalThis.CustomEvent = class {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    };

    try {
        const i18n = createI18n({
            catalogs: TEST_CATALOGS,
            queryString: '?locale=uk',
            fetchFn: null,
            onMissing(payload) {
                diagnostics.push(payload);
            },
            document: {
                documentElement: {},
                dispatchEvent(event) {
                    events.push(event);
                },
            },
        });

        assert.equal(i18n.t('msg.only_en'), 'Only English');
        assert.equal(i18n.t('msg.not_exists'), 'msg.not_exists');

        assert.equal(diagnostics.length, 2);
        assert.equal(diagnostics[0].kind, 'missing_translation');
        assert.equal(diagnostics[0].fallbackLocale, 'en');
        assert.equal(diagnostics[1].kind, 'missing_key');

        const missingEvents = events.filter((event) => event.type === 'frontend:i18n-missing');
        assert.equal(missingEvents.length, 2);
        assert.equal(missingEvents[0].detail.kind, 'missing_translation');
        assert.equal(missingEvents[1].detail.kind, 'missing_key');
    } finally {
        globalThis.CustomEvent = originalCustomEvent;
    }
});

test('loadCatalog appends build id from window.__APP_BUILD_ID__ to locale catalog requests', async () => {
    const originalBuildId = globalThis.__APP_BUILD_ID__;
    const requests = [];
    globalThis.__APP_BUILD_ID__ = 'build-xyz';

    try {
        const i18n = createI18n({
            catalogs: { en: {}, uk: {}, ru: {} },
            queryString: '?locale=en',
            fetchFn: async (url) => {
                requests.push(url);
                return {
                    ok: true,
                    async json() {
                        return { loaded: true };
                    },
                };
            },
        });

        await i18n.loadCatalog('uk');
        assert.ok(requests.some((url) => url.endsWith('/uk.json?v=build-xyz')));
    } finally {
        if (originalBuildId === undefined) {
            delete globalThis.__APP_BUILD_ID__;
        } else {
            globalThis.__APP_BUILD_ID__ = originalBuildId;
        }
    }
});

test('loadCatalog uses fallback catalog version when build id is absent', async () => {
    const originalBuildId = globalThis.__APP_BUILD_ID__;
    const requests = [];
    delete globalThis.__APP_BUILD_ID__;

    try {
        const i18n = createI18n({
            catalogs: { en: {}, uk: {}, ru: {} },
            queryString: '?locale=en',
            fetchFn: async (url) => {
                requests.push(url);
                return {
                    ok: true,
                    async json() {
                        return { loaded: true };
                    },
                };
            },
        });

        await i18n.loadCatalog('uk');
        assert.ok(requests.some((url) => url.endsWith('/uk.json?v=i18n-v1')));
    } finally {
        if (originalBuildId === undefined) {
            delete globalThis.__APP_BUILD_ID__;
        } else {
            globalThis.__APP_BUILD_ID__ = originalBuildId;
        }
    }
});

test('builtin catalogs provide common.loading before remote preload completes', () => {
    const warnings = [];
    const i18n = createI18n({
        queryString: '?locale=uk',
        fetchFn: async () => new Promise(() => {}),
        logger: {
            warn(message) {
                warnings.push(message);
            },
        },
    });

    assert.equal(i18n.t('common.loading'), 'Завантаження...');
    assert.equal(warnings.length, 0);
});
