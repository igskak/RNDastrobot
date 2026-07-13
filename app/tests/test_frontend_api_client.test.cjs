const test = require('node:test');
const assert = require('node:assert/strict');

const API_MODULE_PATH = '../frontend/js/api.js';

function loadApiModule(windowOverride) {
    global.window = windowOverride;
    delete global.document;
    delete require.cache[require.resolve(API_MODULE_PATH)];
    return require(API_MODULE_PATH);
}

test('AstroAPI.calculateNatalChart keeps request contract and sends locale headers', async () => {
    let captured = null;

    global.fetch = async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            async json() {
                return { user_id: 'u-1' };
            },
        };
    };

    const api = loadApiModule({
        location: { hostname: 'localhost' },
        FrontendI18n: {
            getLocale() {
                return 'uk';
            },
        },
    });

    const payload = { first_name: 'A', last_name: 'B' };
    const result = await api.calculateNatalChart(payload);

    assert.deepEqual(result, { user_id: 'u-1' });
    assert.equal(captured.url, 'http://localhost:8000/api/v1/natal/calculate');
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers['Content-Type'], 'application/json');
    assert.equal(captured.init.headers['Accept-Language'], 'uk');
    assert.equal(captured.init.headers['X-Locale'], 'uk');
    assert.equal(captured.init.body, JSON.stringify(payload));
});

test('AstroAPI.calculateNatalChart can skip DB persistence for temporary recalculations', async () => {
    let captured = null;

    global.fetch = async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            async json() {
                return { user_id: null };
            },
        };
    };

    const api = loadApiModule({
        location: { hostname: 'example.com' },
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    });

    await api.calculateNatalChart({ date: '1990-01-01' }, { saveToDb: false });

    assert.equal(captured.url, '/api/v1/natal/calculate?save_to_db=false');
    assert.equal(captured.init.method, 'POST');
});

test('AstroAPI.calculateNatalChart keeps backend compatibility for error payloads', async () => {
    const api = loadApiModule({
        location: { hostname: 'example.com' },
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    });

    global.fetch = async () => ({
        ok: false,
        async json() {
            return { error_code: 'chart.invalid', message: 'Localized error text' };
        },
    });

    await assert.rejects(
        () => api.calculateNatalChart({}),
        (error) => {
            assert.equal(error.message, 'Localized error text');
            return true;
        }
    );

    global.fetch = async () => ({
        ok: false,
        async json() {
            return { detail: 'Legacy detail text' };
        },
    });

    await assert.rejects(
        () => api.calculateNatalChart({}),
        (error) => {
            assert.equal(error.message, 'Legacy detail text');
            return true;
        }
    );
});

test('AstroAPI.buildLoginRedirect preserves safe next target for protected pages', () => {
    const api = loadApiModule({
        location: {
            hostname: 'example.com',
            origin: 'https://example.com',
            pathname: '/forecast-new.html',
            search: '?layer=solar_return',
            hash: '#wheel',
        },
    });

    assert.equal(
        api.buildLoginRedirect('/login.html'),
        '/login.html?next=%2Fforecast-new.html%3Flayer%3Dsolar_return%23wheel'
    );
    assert.equal(api.buildLoginRedirect('/login.html?next=%2Fnew'), '/login.html?next=%2Fnew');
    assert.equal(api.buildLoginRedirect('/not-login.html'), '/not-login.html');
});

test('AstroAPI.resolvePlaceTimezone requests timezone by source_id with locale headers', async () => {
    let captured = null;

    global.fetch = async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            async json() {
                return { source_id: 'geoname:706483', timezone: 'Europe/Kyiv' };
            },
        };
    };

    const api = loadApiModule({
        location: { hostname: 'localhost' },
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    });

    const timezone = await api.resolvePlaceTimezone('geoname:706483');

    assert.equal(timezone, 'Europe/Kyiv');
    assert.equal(
        captured.url,
        'http://localhost:8000/api/v1/places/timezone?source_id=geoname%3A706483'
    );
    assert.equal(captured.init.method, 'GET');
    assert.equal(captured.init.headers['Accept-Language'], 'en');
    assert.equal(captured.init.headers['X-Locale'], 'en');
});

test('AstroAPI.updateClientChart sends PUT request with locale headers', async () => {
    let captured = null;

    global.fetch = async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            async json() {
                return { user_id: 'u-42' };
            },
        };
    };

    const api = loadApiModule({
        location: { hostname: 'localhost' },
        FrontendI18n: {
            getLocale() {
                return 'ru';
            },
        },
    });

    const payload = { first_name: 'Olena', place: 'Kyiv' };
    const result = await api.updateClientChart('u-42', payload);

    assert.deepEqual(result, { user_id: 'u-42' });
    assert.equal(captured.url, 'http://localhost:8000/api/v1/users/u-42');
    assert.equal(captured.init.method, 'PUT');
    assert.equal(captured.init.headers['Content-Type'], 'application/json');
    assert.equal(captured.init.headers['Accept-Language'], 'ru');
    assert.equal(captured.init.body, JSON.stringify(payload));
});

test('AstroAPI client profile and related people helpers use canonical person ids', async () => {
    const calls = [];
    global.fetch = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, async json() { return []; } };
    };
    const api = loadApiModule({
        location: { hostname: 'example.com' },
        FrontendI18n: { getLocale() { return 'en'; } },
    });

    assert.equal(api.buildClientProfileUrl('person-42'), '/client/person-42');
    await api.getRelatedPeople('person-42');
    await api.linkRelatedPerson('person-42', { related_user_id: 'person-99', relation_label: 'Partner' });
    await api.deleteRelatedPerson('person-42', 'person-99');

    assert.equal(calls[0].url, '/api/v1/persons/person-42/related-people');
    assert.equal(calls[1].url, '/api/v1/persons/person-42/related-people');
    assert.deepEqual(JSON.parse(calls[1].init.body), {
        related_person_id: 'person-99',
        relation_label: 'Partner',
        notes: null,
    });
    assert.equal(calls[2].url, '/api/v1/persons/person-42/related-people/person-99');
});

test('AstroAPI exposes plan helper state from auth response', async () => {
    global.fetch = async () => ({
        ok: true,
        async json() {
            return {
                id: 'a-1',
                email: 'astro@example.com',
                plan_code: 'trial',
                entitlements: {
                    calls_enabled: false,
                    consultations_enabled: true,
                    assistant_enabled: false,
                },
                usage: {
                    saved_charts_count: 5,
                    max_saved_charts: 5,
                },
            };
        },
    });

    const windowOverride = {
        location: { hostname: 'example.com' },
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    };
    const api = loadApiModule(windowOverride);
    const me = await api.getCurrentAstrologer();

    assert.equal(me.plan_code, 'trial');
    assert.equal(api.canUseFeature('calls'), false);
    assert.equal(api.canUseFeature('consultations'), true);
    assert.equal(api.canUseFeature('assistant'), false);
    assert.deepEqual(api.getSavedChartLimitState(), {
        current: 5,
        max: 5,
        reached: true,
    });
    assert.equal(windowOverride.AstroPlan.canUseFeature('calls'), false);
});

test('AstroAPI.updateCurrentPlan sends selected plan and refreshes cache', async () => {
    let captured = null;
    global.fetch = async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            async json() {
                return {
                    id: 'a-1',
                    email: 'astro@example.com',
                    plan_code: 'pro',
                    entitlements: {
                        calls_enabled: true,
                    },
                    usage: {
                        saved_charts_count: 2,
                        max_saved_charts: null,
                    },
                };
            },
        };
    };

    const api = loadApiModule({
        location: { hostname: 'localhost' },
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    });

    const updated = await api.updateCurrentPlan('pro');

    assert.equal(captured.url, 'http://localhost:8000/api/v1/auth/me/plan');
    assert.equal(captured.init.method, 'PATCH');
    assert.equal(captured.init.headers['Content-Type'], 'application/json');
    assert.equal(captured.init.headers['Accept-Language'], 'en');
    assert.equal(captured.init.body, JSON.stringify({ plan_code: 'pro' }));
    assert.equal(updated.plan_code, 'pro');
    assert.equal(api.canUseFeature('calls'), true);
    assert.equal(api.getSavedChartLimitState().max, null);
});

test('AstroAPI.createBillingCheckout starts hosted checkout with locale headers', async () => {
    let captured = null;
    global.fetch = async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            async json() {
                return {
                    checkout_url: 'https://checkout.example/session',
                    provider: 'paddle',
                };
            },
        };
    };

    const api = loadApiModule({
        location: { hostname: 'localhost' },
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    });

    const checkout = await api.createBillingCheckout({
        planCode: 'pro',
        interval: 'monthly',
        couponCode: 'WELCOME',
    });

    assert.equal(captured.url, 'http://localhost:8000/api/v1/billing/checkout');
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers['Content-Type'], 'application/json');
    assert.equal(captured.init.headers['Accept-Language'], 'en');
    assert.equal(captured.init.body, JSON.stringify({
        plan_code: 'pro',
        interval: 'monthly',
        coupon_code: 'WELCOME',
    }));
    assert.equal(checkout.checkout_url, 'https://checkout.example/session');
});

test('AstroAPI preserves backend speed_percent when normalizing chart motion', () => {
    const storage = new Map();
    const sessionStorage = {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            storage.set(key, String(value));
        },
        removeItem(key) {
            storage.delete(key);
        },
    };
    const localStorage = {
        getItem() {
            return null;
        },
        setItem() {},
        removeItem() {},
    };
    global.sessionStorage = sessionStorage;
    global.localStorage = localStorage;

    const api = loadApiModule({
        location: { hostname: 'example.com' },
        sessionStorage,
        localStorage,
        FrontendI18n: {
            getLocale() {
                return 'en';
            },
        },
    });

    api.saveChartToSession({
        user_id: 'u-99',
        planets: [
            {
                name: 'Mercury',
                speed: 0.72,
                speed_percent: 52,
                retrograde: false,
                is_stationary: false,
                stationary_type: null,
            },
        ],
    });

    const chart = api.getChartFromSession();
    assert.equal(chart.planets[0].speed_percent, 52);
    assert.equal(chart.planets[0].is_stationary, false);
    assert.equal(chart.planets[0].stationary_type, null);
});
