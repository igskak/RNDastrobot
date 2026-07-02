const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');

const modal = require('../frontend/js/forecast-aspect-dynamics-modal.js');

function resetModal() {
    const state = modal._state;
    state.overlay?.remove?.();
    Object.assign(state, {
        overlay: null,
        dialog: null,
        canvas: null,
        status: null,
        summary: null,
        title: null,
        subtitle: null,
        closeButton: null,
        data: null,
        lastFocus: null,
        resizeObserver: null,
        fetchImpl: null,
    });
}

function setupDom() {
    resetModal();
    const dom = new JSDOM('<!doctype html><html><body><button id="origin">Open</button></body></html>', {
        pretendToBeVisual: true,
        url: 'http://localhost/forecast-new.html',
    });
    global.document = dom.window.document;
    global.window = dom.window;
    global.CustomEvent = dom.window.CustomEvent;
    global.ResizeObserver = undefined;
    global.devicePixelRatio = 1;
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({
        setTransform() {},
        clearRect() {},
        fillRect() {},
        fillText() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fill() {},
        arc() {},
        closePath() {},
        save() {},
        restore() {},
        setLineDash() {},
    });
    global.FrontendI18n = {
        getLocale: () => 'en',
        t: (key, params) => {
            if (key === 'page.forecastNew.aspectDynamics.pass') return `Pass ${params.number}`;
            const map = {
                'common.close': 'Close',
                'common.orb': 'Orb',
                'common.notAvailable': 'N/A',
                'page.forecast.timeline.tooltip.enter': 'Enter',
                'page.forecast.timeline.tooltip.leave': 'Leave',
                'page.forecastNew.aspectDynamics.closest': 'Closest approach',
                'page.forecastNew.aspectDynamics.loading': 'Calculating aspect dynamics...',
                'page.forecastNew.aspectDynamics.legend.orb': 'signed orb',
                'page.forecastNew.aspectDynamics.legend.selected': 'selected date',
                'page.forecastNew.aspectDynamics.legend.exact': 'exact aspect',
                'page.forecastNew.aspectDynamics.noExactPass': 'No exact crossing',
            };
            return map[key] || key;
        },
    };
    global.AstroAPI = {
        API_BASE_URL: '/api/v1',
        withLocaleHeaders: (headers) => headers,
    };
    global.Symbols = {
        planets: { Pluto: 'P', Sun: 'S' },
        aspects: { Trine: 'tri' },
        getPlanetSymbol: (name) => ({ Pluto: 'P', Sun: 'S' }[name] || name),
        getAspectDisplay: (name) => ({ Trine: 'tri' }[name] || name),
        normalizeBodyName: (name) => name,
    };
    return dom;
}

function sampleResponse() {
    return {
        transit_body: 'Pluto',
        natal_body: 'Sun',
        aspect_type: 'Trine',
        timezone: 'UTC',
        calc_version: 'aspect_dynamics_v1',
        status: 'ok',
        orb_used: 5,
        selected_point: {
            datetime: '2026-06-29T12:00:00+00:00',
            signed_orb: 0.2,
            abs_orb: 0.2,
        },
        contacts: [{
            enter: '2026-06-01T00:00:00+00:00',
            leave: '2026-07-01T00:00:00+00:00',
            passes: [{
                date: '2026-06-20T00:00:00+00:00',
                motion: 'direct',
                orb: 0,
            }],
            stations: [],
            closest_approach: {
                date: '2026-06-20T00:00:00+00:00',
                orb: 0,
            },
        }],
        series: [
            { datetime: '2026-06-01T00:00:00+00:00', signed_orb: 3, abs_orb: 3 },
            { datetime: '2026-06-20T00:00:00+00:00', signed_orb: 0, abs_orb: 0 },
            { datetime: '2026-07-01T00:00:00+00:00', signed_orb: -3, abs_orb: 3 },
        ],
    };
}

const sampleOpenOptions = {
    userId: 'chart-1',
    timezone: 'UTC',
    selectedDateTime: '2026-06-29T12:00:00',
    aspect: {
        transit_planet: 'Pluto',
        natal_object: 'Sun',
        aspect_type: 'Trine',
    },
};

test('buildPayload maps transit aspect fields and selected datetime', () => {
    const payload = modal.buildPayload({
        userId: 'chart-1',
        timezone: 'Europe/Madrid',
        selectedDateTime: '2026-06-29T14:35',
        aspect: {
            transit_planet: 'Pluto',
            natal_object: 'Sun',
            aspect_type: 'Trine',
        },
    });

    assert.deepEqual(payload, {
        user_id: 'chart-1',
        transit_body: 'Pluto',
        natal_body: 'Sun',
        aspect_type: 'Trine',
        selected_date: '2026-06-29',
        selected_time: '14:35:00',
        timezone: 'Europe/Madrid',
        max_points: 320,
    });
});

test('forecast-new aspect clicks open dynamics modal without pinning', () => {
    const source = fs.readFileSync(path.join(__dirname, '../frontend/js/forecast-new.js'), 'utf8');

    assert.equal(source.includes('togglePinnedAspectKey'), false);
    assert.equal(source.includes('pinnedAspectKey'), false);
    assert.match(source, /openAspectDynamicsByKey\(key, row\?\.dataset\?\.aspectType\)/);
    assert.match(source, /openAspectDynamicsByKey\(key, cell\?\.dataset\?\.aspectType\)/);
    assert.match(source, /openAspectDynamicsByKey\(key, line\?\.dataset\?\.aspectType \|\| line\?\.dataset\?\.type\)/);
});

test('modal renders loading state while dynamics request is pending', async () => {
    setupDom();
    let resolveFetch;
    const pendingFetch = new Promise((resolve) => {
        resolveFetch = resolve;
    });
    modal.setFetchImpl(() => pendingFetch);

    const openPromise = modal.open(sampleOpenOptions);

    assert.equal(document.querySelector('.aspect-dynamics-status').textContent, 'Calculating aspect dynamics...');
    resolveFetch({
        ok: true,
        async json() {
            return sampleResponse();
        },
    });
    await openPromise;
    modal.close();
});

test('modal renders error state when dynamics request fails', async () => {
    setupDom();
    modal.setFetchImpl(async () => ({
        ok: false,
        status: 502,
        async json() {
            return { detail: 'Dynamics service failed' };
        },
    }));

    const result = await modal.open(sampleOpenOptions);

    assert.equal(result, null);
    const status = document.querySelector('.aspect-dynamics-status');
    assert.ok(status.classList.contains('aspect-dynamics-status--error'));
    assert.equal(status.textContent, 'Dynamics service failed');
    modal.close();
});

test('modal renders success summary from fetched dynamics data', async () => {
    setupDom();
    modal.setFetchImpl(async (url, options) => {
        assert.equal(url, '/api/v1/transits/aspect-dynamics');
        const payload = JSON.parse(options.body);
        assert.equal(payload.transit_body, 'Pluto');
        return {
            ok: true,
            async json() {
                return sampleResponse();
            },
        };
    });

    await modal.open(sampleOpenOptions);

    const overlay = document.querySelector('.aspect-dynamics-modal');
    assert.ok(overlay);
    assert.equal(overlay.classList.contains('hidden'), false);
    assert.match(document.querySelector('#aspectDynamicsTitle').textContent, /P tri S/);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Closest approach/);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Pass 1/);
    modal.close();
});
