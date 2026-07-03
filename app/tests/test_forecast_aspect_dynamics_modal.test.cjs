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
        overviewCanvas: null,
        chartWrap: null,
        status: null,
        summary: null,
        title: null,
        subtitle: null,
        closeButton: null,
        toolbar: null,
        scrubber: null,
        data: null,
        lastFocus: null,
        resizeObserver: null,
        fetchImpl: null,
        basePayload: null,
        requestSeq: 0,
        responseCache: new Map(),
        dragStart: null,
        pendingWindowTimer: null,
        scrollDomain: null,
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

function sampleResponse(overrides = {}) {
    const base = {
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
    return {
        ...base,
        ...overrides,
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
        method: 'transit',
        source_body: 'Pluto',
        target_body: 'Sun',
        transit_body: 'Pluto',
        natal_body: 'Sun',
        aspect_type: 'Trine',
        selected_date: '2026-06-29',
        selected_time: '14:35:00',
        timezone: 'Europe/Madrid',
        max_points: 320,
    });
});

test('buildPayload maps non-transit layer context and partner source', () => {
    const payload = modal.buildPayload({
        method: 'synastry_partner',
        natalSource: { user_id: 'primary-1' },
        partnerSource: { user_id: 'partner-1' },
        timezone: 'UTC',
        selectedDateTime: '1990-02-03T04:05:00',
        aspect: {
            planet_1: 'Venus',
            planet_2: 'Mars',
            aspect_type: 'Square',
        },
    });

    assert.equal(payload.method, 'synastry_partner');
    assert.equal(payload.user_id, 'primary-1');
    assert.deepEqual(payload.partner, { user_id: 'partner-1' });
    assert.equal(payload.source_body, 'Venus');
    assert.equal(payload.target_body, 'Mars');
    assert.equal(payload.selected_date, '1990-02-03');
    assert.equal(payload.selected_time, '04:05:00');
});

test('forecast-new aspect clicks open dynamics modal without pinning', () => {
    const source = fs.readFileSync(path.join(__dirname, '../frontend/js/forecast-new.js'), 'utf8');
    const wheelSource = fs.readFileSync(path.join(__dirname, '../frontend/js/prognostic-rings-wheel.js'), 'utf8');

    assert.equal(source.includes('togglePinnedAspectKey'), false);
    assert.equal(source.includes('pinnedAspectKey'), false);
    assert.match(source, /document\.addEventListener\('click', handleAspectDynamicsClick\)/);
    assert.match(source, /\.aspect-symbol-group\[data-aspect-key\]/);
    assert.match(source, /#natalAspectsView tr\[data-aspect-key\]/);
    assert.match(source, /#natalGridView td\[data-aspect-key\]/);
    assert.match(source, /openWheelAspectDynamicsFromNode\(wheelNode\)/);
    assert.match(wheelSource, /createAspectHitElement/);
    assert.match(wheelSource, /class: 'aspect-line aspect-hit'/);
    assert.match(wheelSource, /'stroke-width': 14/);
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
    const payloads = [];
    modal.setFetchImpl(async (url, options) => {
        assert.equal(url, '/api/v1/transits/aspect-dynamics');
        const payload = JSON.parse(options.body);
        payloads.push(payload);
        assert.equal(payload.transit_body, 'Pluto');
        assert.equal(payload.method, 'transit');
        return {
            ok: true,
            async json() {
                return sampleResponse(payload.preview ? {
                    preview: true,
                    boundary_complete: false,
                    contacts: [],
                } : { preview: false });
            },
        };
    });

    await modal.open(sampleOpenOptions);

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].preview, true);
    assert.equal(payloads[0].max_points, 96);
    assert.equal(payloads[1].preview, false);
    assert.equal(payloads[1].max_points, 320);
    const overlay = document.querySelector('.aspect-dynamics-modal');
    assert.ok(overlay);
    assert.equal(overlay.classList.contains('hidden'), false);
    assert.ok(document.querySelector('.aspect-dynamics-overview-canvas'));
    assert.equal(document.querySelector('.aspect-dynamics-scrollbar').disabled, false);
    assert.match(document.querySelector('#aspectDynamicsTitle').textContent, /P tri S/);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Closest approach/);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Pass 1/);
    modal.close();
});

test('modal paints preview before full dynamics response resolves', async () => {
    setupDom();
    let resolveFull;
    const fullResponse = new Promise((resolve) => {
        resolveFull = resolve;
    });
    const payloads = [];
    modal.setFetchImpl((_, options) => {
        const payload = JSON.parse(options.body);
        payloads.push(payload);
        if (payload.preview) {
            return Promise.resolve({
                ok: true,
                async json() {
                    return sampleResponse({
                        preview: true,
                        boundary_complete: false,
                        contacts: [],
                    });
                },
            });
        }
        return fullResponse;
    });

    const openPromise = modal.open(sampleOpenOptions);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].preview, true);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Calculating aspect dynamics/);
    assert.equal(modal._state.data.preview, true);

    resolveFull({
        ok: true,
        async json() {
            return sampleResponse({ preview: false });
        },
    });
    await openPromise;

    assert.equal(modal._state.data.preview, false);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Pass 1/);
    modal.close();
});

test('modal keeps preview chart when full dynamics request fails', async () => {
    setupDom();
    modal.setFetchImpl(async (_, options) => {
        const payload = JSON.parse(options.body);
        if (payload.preview) {
            return {
                ok: true,
                async json() {
                    return sampleResponse({
                        preview: true,
                        boundary_complete: false,
                        contacts: [],
                    });
                },
            };
        }
        return {
            ok: false,
            status: 504,
            async json() {
                return { detail: 'Full dynamics timed out' };
            },
        };
    });

    const result = await modal.open(sampleOpenOptions);

    assert.equal(result.preview, true);
    assert.equal(modal._state.data.preview, true);
    const status = document.querySelector('.aspect-dynamics-status');
    assert.ok(status.classList.contains('aspect-dynamics-status--error'));
    assert.equal(status.textContent, 'Full dynamics timed out');
    modal.close();
});

test('toolbar range control requests a new graph window', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponse();
            },
        };
    });

    await modal.open(sampleOpenOptions);
    document.querySelector('[data-aspect-dynamics-range="3650"]').click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(payloads.length, 3);
    assert.equal(payloads[2].preview, false);
    assert.equal(payloads[2].contact_start, '2021-06-30');
    assert.equal(payloads[2].contact_end, '2031-06-28');
    assert.equal(payloads[2].max_points, 720);
    modal.close();
});

test('scrollbar scrub requests a shifted graph window', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponse();
            },
        };
    });

    await modal.open(sampleOpenOptions);
    const input = document.querySelector('.aspect-dynamics-scrollbar');
    input.value = '700';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(payloads.length, 3);
    assert.equal(payloads[2].preview, false);
    assert.equal(payloads[2].max_points, 320);
    assert.ok(payloads[2].contact_start > '2027-01-01');
    assert.ok(payloads[2].contact_end > payloads[2].contact_start);
    modal.close();
});
