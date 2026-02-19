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
