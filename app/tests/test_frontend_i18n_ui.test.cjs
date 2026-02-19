const test = require('node:test');
const assert = require('node:assert/strict');

const { createI18n } = require('../frontend/js/i18n.js');
const i18nUi = require('../frontend/js/i18n-ui.js');

function makeDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function createNode(dataset = {}) {
    return {
        dataset: { ...dataset },
        textContent: '',
        innerHTML: '',
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
    };
}

function createFakeDocument(nodes, titleEl = null) {
    const listeners = new Map();

    return {
        documentElement: { lang: 'en' },
        title: '',
        querySelector(selector) {
            if (selector === 'title[data-i18n]') return titleEl;
            return null;
        },
        querySelectorAll() {
            return nodes;
        },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
            return true;
        },
    };
}

function installCustomEventStub() {
    const prev = global.CustomEvent;
    global.CustomEvent = class CustomEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    };
    return () => {
        if (prev === undefined) {
            delete global.CustomEvent;
        } else {
            global.CustomEvent = prev;
        }
    };
}

test('i18n-ui applies translations on initial render for multiple page modules', () => {
    const catalogs = {
        en: {
            page: {
                index: { title: 'Natal chart calculator' },
                chart: { title: 'Natal chart' },
                clients: { searchPlaceholder: 'Search clients' },
            },
        },
        uk: { page: { index: { title: 'Калькулятор натальної карти' } } },
        ru: {},
    };

    const runtime = createI18n({ catalogs, queryString: '?locale=en', fetchFn: null });
    global.FrontendI18n = runtime;

    const titleEl = createNode({ i18n: 'page.index.title' });
    const indexTitle = createNode({ i18n: 'page.index.title' });
    const chartTitle = createNode({ i18n: 'page.chart.title' });
    const searchInput = createNode({ i18nPlaceholder: 'page.clients.searchPlaceholder' });
    const doc = createFakeDocument([indexTitle, chartTitle, searchInput], titleEl);

    i18nUi.applyI18n(doc);

    assert.equal(indexTitle.textContent, 'Natal chart calculator');
    assert.equal(chartTitle.textContent, 'Natal chart');
    assert.equal(searchInput.attributes.placeholder, 'Search clients');
    assert.equal(doc.title, 'Natal chart calculator');

    delete global.FrontendI18n;
});

test('i18n-ui reacts to setLocale() via frontend:locale-changed event', async () => {
    const restoreCustomEvent = installCustomEventStub();

    const catalogs = {
        en: { page: { index: { title: 'Natal chart calculator' } } },
        uk: { page: { index: { title: 'Калькулятор натальної карти' } } },
        ru: {},
    };

    const titleNode = createNode({ i18n: 'page.index.title' });
    const doc = createFakeDocument([titleNode]);

    const runtime = createI18n({
        catalogs,
        queryString: '?locale=en',
        fetchFn: null,
        document: doc,
    });
    global.FrontendI18n = runtime;

    i18nUi.bindI18nUi({ document: doc });
    await runtime.ready;
    await Promise.resolve();
    assert.equal(titleNode.textContent, 'Natal chart calculator');

    await runtime.setLocale('uk', { persist: false, source: 'test' });

    assert.equal(runtime.getLocale(), 'uk');
    assert.equal(doc.documentElement.lang, 'uk');
    assert.equal(titleNode.textContent, 'Калькулятор натальної карти');

    restoreCustomEvent();
    delete global.FrontendI18n;
});

test('i18n-ui waits for FrontendI18n.ready before first applyI18n', async () => {
    const restoreCustomEvent = installCustomEventStub();
    const warnings = [];
    const ukCatalog = makeDeferred();

    const titleNode = createNode({ i18n: 'page.index.title' });
    const doc = createFakeDocument([titleNode]);

    const runtime = createI18n({
        catalogs: {
            en: { page: { index: { title: 'English title' } } },
            uk: {},
            ru: {},
        },
        queryString: '?locale=uk',
        fetchFn: async (url) => {
            if (url.includes('/uk.json')) {
                return ukCatalog.promise;
            }
            if (url.includes('/en.json')) {
                return {
                    ok: true,
                    async json() {
                        return { page: { index: { title: 'English title' } } };
                    },
                };
            }
            throw new Error(`Unexpected locale request: ${url}`);
        },
        logger: {
            warn(message) {
                warnings.push(message);
            },
        },
        document: doc,
    });
    global.FrontendI18n = runtime;

    i18nUi.bindI18nUi({ document: doc });

    assert.equal(titleNode.textContent, '');
    assert.equal(warnings.some((line) => line.includes('missing_translation')), false);

    ukCatalog.resolve({
        ok: true,
        async json() {
            return { page: { index: { title: 'Український заголовок' } } };
        },
    });

    await runtime.ready;
    await Promise.resolve();

    assert.equal(titleNode.textContent, 'Український заголовок');
    assert.equal(warnings.some((line) => line.includes('missing_translation')), false);

    restoreCustomEvent();
    delete global.FrontendI18n;
});

test('i18n-ui fallback uses en, missing key does not crash and returns key', () => {
    const warnings = [];
    const catalogs = {
        en: { page: { clients: { title: 'Client database' } } },
        uk: {},
        ru: {},
    };

    const runtime = createI18n({
        catalogs,
        queryString: '?locale=uk',
        fetchFn: null,
        logger: {
            warn(message) {
                warnings.push(message);
            },
        },
    });
    global.FrontendI18n = runtime;

    const fromFallback = createNode({ i18n: 'page.clients.title' });
    const missingEverywhere = createNode({ i18n: 'page.unknown.key' });
    const doc = createFakeDocument([fromFallback, missingEverywhere]);

    i18nUi.applyI18n(doc);

    assert.equal(fromFallback.textContent, 'Client database');
    assert.equal(missingEverywhere.textContent, 'page.unknown.key');
    assert.ok(warnings.some((line) => line.includes('missing_translation') && line.includes('page.clients.title')));
    assert.ok(warnings.some((line) => line.includes('missing_key') && line.includes('page.unknown.key')));

    delete global.FrontendI18n;
});
