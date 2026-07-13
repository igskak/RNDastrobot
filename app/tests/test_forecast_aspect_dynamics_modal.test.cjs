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
        responseInFlight: new Map(),
        dragStart: null,
        interactionWindow: null,
        defaultViewWindow: null,
        pendingWindowTimer: null,
        scrollDomain: null,
        isLoading: false,
        hoverMs: null,
        hoverOrb: null,
        hoverFrame: null,
        yScaleFactor: 1,
        viewportTouched: false,
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
        strokeRect() {},
        measureText(text) {
            return { width: String(text || '').length * 6 };
        },
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
                'page.forecastNew.aspectDynamics.loading': 'Loading chart...',
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

function sampleResponseForPayload(payload = {}) {
    if (!payload.contact_start || !payload.contact_end) {
        return sampleResponse(payload.preview ? {
            preview: true,
            boundary_complete: false,
            contacts: [],
        } : { preview: false });
    }
    return sampleResponse({
        method: payload.method || 'transit',
        source_body: payload.source_body || payload.transit_body || 'Pluto',
        target_body: payload.target_body || payload.natal_body || 'Sun',
        transit_body: payload.transit_body || payload.source_body || 'Pluto',
        natal_body: payload.natal_body || payload.target_body || 'Sun',
        preview: false,
        effective_window: {
            start: `${payload.contact_start}T00:00:00+00:00`,
            end: `${payload.contact_end}T00:00:00+00:00`,
        },
        series: [
            { datetime: `${payload.contact_start}T00:00:00+00:00`, signed_orb: 4, abs_orb: 4 },
            { datetime: '2026-06-01T00:00:00+00:00', signed_orb: 3, abs_orb: 3 },
            { datetime: '2026-06-20T00:00:00+00:00', signed_orb: 0, abs_orb: 0 },
            { datetime: '2026-07-01T00:00:00+00:00', signed_orb: -3, abs_orb: 3 },
            { datetime: `${payload.contact_end}T00:00:00+00:00`, signed_orb: -4, abs_orb: 4 },
        ],
    });
}

function multiContactResponseForPayload(payload = {}) {
    const data = sampleResponseForPayload(payload);
    if (!payload.contact_start || !payload.contact_end) return data;
    return {
        ...data,
        contacts: [
            {
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
            },
            {
                enter: '2027-06-01T00:00:00+00:00',
                leave: '2027-07-01T00:00:00+00:00',
                passes: [{
                    date: '2027-06-20T00:00:00+00:00',
                    motion: 'retrograde',
                    orb: 0,
                }],
                stations: [{
                    date: '2027-06-25T00:00:00+00:00',
                    type: 'R',
                }],
                closest_approach: {
                    date: '2027-06-20T00:00:00+00:00',
                    orb: 0,
                },
            },
        ],
        series: [
            { datetime: `${payload.contact_start}T00:00:00+00:00`, signed_orb: 4, abs_orb: 4 },
            { datetime: '2026-06-01T00:00:00+00:00', signed_orb: 3, abs_orb: 3 },
            { datetime: '2026-06-20T00:00:00+00:00', signed_orb: 0, abs_orb: 0 },
            { datetime: '2026-07-01T00:00:00+00:00', signed_orb: -3, abs_orb: 3 },
            { datetime: '2027-06-01T00:00:00+00:00', signed_orb: 3, abs_orb: 3 },
            { datetime: '2027-06-20T00:00:00+00:00', signed_orb: 0, abs_orb: 0 },
            { datetime: '2027-07-01T00:00:00+00:00', signed_orb: -3, abs_orb: 3 },
            { datetime: `${payload.contact_end}T00:00:00+00:00`, signed_orb: -4, abs_orb: 4 },
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

function dispatchDomEvent(target, type, props = {}) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.entries(props).forEach(([key, value]) => {
        Object.defineProperty(event, key, { value, configurable: true });
    });
    target.dispatchEvent(event);
    return event;
}

function dispatchPointer(target, type, props = {}) {
    return dispatchDomEvent(target, type, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 0,
        clientY: 0,
        ...props,
    });
}

function windowSpanDays() {
    const window = modal._state.interactionWindow;
    return (window.end - window.start) / 86400000;
}

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

    assert.equal(document.querySelector('.aspect-dynamics-status').textContent, 'Loading chart...');
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
                return sampleResponseForPayload(payload);
            },
        };
    });

    await modal.open(sampleOpenOptions);

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].preview, true);
    assert.equal(payloads[0].max_points, 96);
    assert.equal(payloads[1].preview, false);
    assert.equal(payloads[1].max_points, 360);
    assert.ok(payloads[1].contact_start < '2026-06-29');
    assert.ok(payloads[1].contact_end > '2026-06-29');
    assert.ok(payloads[1].contact_start > '2025-01-01');
    assert.ok(payloads[1].contact_end < '2028-01-01');
    const overlay = document.querySelector('.aspect-dynamics-modal');
    assert.ok(overlay);
    assert.equal(overlay.classList.contains('hidden'), false);
    assert.ok(document.querySelector('.aspect-dynamics-overview-canvas'));
    assert.equal(document.querySelector('.aspect-dynamics-scrollbar').disabled, false);
    assert.match(document.querySelector('#aspectDynamicsTitle').textContent, /P tri S/);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Closest approach/);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Pass 1/);
    assert.ok(document.querySelector('.aspect-dynamics-summary-table'));
    assert.equal(document.querySelector('.aspect-dynamics-summary-grid'), null);
    modal.close();
});

test('modal uses slow and fast transit default viewport spans', async () => {
    setupDom();
    modal.setFetchImpl(async (_url, options) => ({
        ok: true,
        async json() {
            return sampleResponseForPayload(JSON.parse(options.body));
        },
    }));

    await modal.open(sampleOpenOptions);
    const slowSpan = windowSpanDays();
    assert.ok(slowSpan > 175 && slowSpan < 190);
    modal.close();

    setupDom();
    modal.setFetchImpl(async (_url, options) => ({
        ok: true,
        async json() {
            return sampleResponseForPayload(JSON.parse(options.body));
        },
    }));

    await modal.open({
        ...sampleOpenOptions,
        aspect: {
            transit_planet: 'Mars',
            natal_object: 'Sun',
            aspect_type: 'Trine',
        },
    });
    const fastSpan = windowSpanDays();
    assert.ok(fastSpan > 29 && fastSpan < 31);
    modal.close();
});

test('detail budget follows canvas width and fast-body multiplier', () => {
    setupDom();
    assert.equal(modal._test.detailPointBudget(720, 'Pluto'), 360);
    assert.equal(modal._test.detailPointBudget(720, 'Moon'), 540);
    assert.equal(modal._test.detailPointBudget(200, 'Mars'), 160);
    assert.equal(modal._test.detailPointBudget(2400, 'Moon'), 1200);
});

test('resize refetches only when point budget changes by more than 25 percent', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        const payload = JSON.parse(options.body);
        payloads.push(payload);
        return {
            ok: true,
            async json() {
                return sampleResponseForPayload(payload);
            },
        };
    });
    await modal.open(sampleOpenOptions);
    const wrap = document.querySelector('.aspect-dynamics-chart-wrap');
    Object.defineProperty(wrap, 'clientWidth', { value: 1200, configurable: true });
    modal._test.handleChartResize();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(payloads.length, 3);
    assert.equal(payloads[2].max_points, 600);
    modal.close();
});

test('graph segments break at missing values and angular wrap', () => {
    const data = {
        series: [
            { datetime: '2026-01-01T00:00:00Z', signed_orb: 10 },
            { datetime: '2026-01-02T00:00:00Z', signed_orb: 12 },
            { datetime: '2026-01-03T00:00:00Z', signed_orb: null },
            { datetime: '2026-01-04T00:00:00Z', signed_orb: 179 },
            { datetime: '2026-01-05T00:00:00Z', signed_orb: -179 },
            { datetime: '2026-01-06T00:00:00Z', signed_orb: -170 },
        ],
    };
    assert.deepEqual(modal._test.graphSegments(data).map((segment) => segment.length), [2, 1, 2]);
});

test('PCHIP tangents flatten local extrema and preserve monotone direction', () => {
    const extrema = modal._test.pchipTangents([
        { x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 1 },
    ]);
    assert.equal(extrema[1], 0);
    const monotone = modal._test.pchipTangents([
        { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 3 },
    ]);
    assert.ok(monotone.every((value) => value >= 0));
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
                    return sampleResponseForPayload(payload);
                },
            });
        }
        return fullResponse;
    });

    const openPromise = modal.open(sampleOpenOptions);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].preview, true);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Loading chart/);
    assert.equal(modal._state.data.preview, true);
    const previewWindow = { ...modal._state.interactionWindow };

    resolveFull({
        ok: true,
        async json() {
            return sampleResponseForPayload(JSON.parse(payloads[1] ? JSON.stringify(payloads[1]) : '{}'));
        },
    });
    await openPromise;

    assert.equal(modal._state.data.preview, false);
    assert.ok(modal._state.interactionWindow.start < previewWindow.start);
    assert.ok(modal._state.interactionWindow.end > previewWindow.end);
    assert.match(document.querySelector('.aspect-dynamics-summary').textContent, /Pass 1/);
    modal.close();
});

test('summary follows the currently visible aspect window', async () => {
    setupDom();
    modal.setFetchImpl(async (_url, options) => ({
        ok: true,
        async json() {
            return multiContactResponseForPayload(JSON.parse(options.body));
        },
    }));

    await modal.open(sampleOpenOptions);
    let summary = document.querySelector('.aspect-dynamics-summary').textContent;
    assert.match(summary, /2026/);
    assert.doesNotMatch(summary, /2027/);

    document.querySelector('[data-aspect-dynamics-range="3650"]').click();
    summary = document.querySelector('.aspect-dynamics-summary').textContent;
    assert.match(summary, /2026/);
    assert.match(summary, /2027/);
    assert.match(summary, /Pass 2/);
    assert.match(summary, /retrograde/);
    assert.equal(document.querySelectorAll('.aspect-dynamics-summary-table tbody tr').length, 2);
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
                    return sampleResponseForPayload(payload);
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

test('toolbar range control fetches the selected visible window', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponseForPayload(JSON.parse(options.body));
            },
        };
    });

    await modal.open(sampleOpenOptions);
    document.querySelector('[data-aspect-dynamics-range="3650"]').click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(payloads.length, 3);
    assert.ok(modal._state.interactionWindow);
    assert.ok(modal._state.interactionWindow.start < new Date('2022-01-01T00:00:00Z').getTime());
    assert.ok(modal._state.interactionWindow.end > new Date('2030-01-01T00:00:00Z').getTime());
    modal.close();
});

test('scrollbar scrub fetches the shifted visible window after debounce', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponseForPayload(JSON.parse(options.body));
            },
        };
    });

    await modal.open(sampleOpenOptions);
    const input = document.querySelector('.aspect-dynamics-scrollbar');
    input.value = '700';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(payloads.length, 3);
    assert.ok(modal._state.interactionWindow.start > new Date('2027-01-01T00:00:00Z').getTime());
    modal.close();
});

test('dragging the aspect chart pans the graph window', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponseForPayload(JSON.parse(options.body));
            },
        };
    });

    await modal.open(sampleOpenOptions);
    const wrap = document.querySelector('.aspect-dynamics-chart-wrap');
    dispatchPointer(wrap, 'pointerdown', { clientX: 360 });
    dispatchPointer(wrap, 'pointermove', { clientX: 260 });

    assert.equal(modal._state.dragStart.moved, true);
    assert.ok(modal._state.interactionWindow);
    assert.ok(wrap.classList.contains('is-dragging'));

    dispatchPointer(wrap, 'pointerup', { clientX: 260 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(payloads.length, 3);
    assert.equal(wrap.classList.contains('is-dragging'), false);
    modal.close();
});

test('wheel scroll zoom fetches the visible window after debounce', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponseForPayload(JSON.parse(options.body));
            },
        };
    });

    await modal.open(sampleOpenOptions);
    const wrap = document.querySelector('.aspect-dynamics-chart-wrap');
    const before = modal._state.interactionWindow;
    dispatchDomEvent(wrap, 'wheel', { deltaY: 90, deltaX: 0, deltaMode: 0 });

    const after = modal._state.interactionWindow;
    assert.ok(after);
    assert.ok((after.end - after.start) > (before.end - before.start));
    assert.ok(Math.abs(((after.start + after.end) / 2) - ((before.start + before.end) / 2)) < 3 * 86400000);

    await new Promise((resolve) => setTimeout(resolve, 140));
    assert.equal(payloads.length, 3);
    modal.close();
});

test('toolbar y-axis controls adjust vertical scale without shifting the window', async () => {
    setupDom();
    modal.setFetchImpl(async (_url, options) => ({
        ok: true,
        async json() {
            return sampleResponseForPayload(JSON.parse(options.body));
        },
    }));

    await modal.open(sampleOpenOptions);
    const before = { ...modal._state.interactionWindow };
    document.querySelector('[data-aspect-dynamics-y-zoom="in"]').click();

    assert.ok(modal._state.yScaleFactor < 1);
    assert.equal(modal._state.interactionWindow.start, before.start);
    assert.equal(modal._state.interactionWindow.end, before.end);
    modal.close();
});

test('pointer hover marks the timeline date and signed orb without requesting more data', async () => {
    setupDom();
    const payloads = [];
    modal.setFetchImpl(async (_url, options) => {
        payloads.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return sampleResponseForPayload(JSON.parse(options.body));
            },
        };
    });

    await modal.open(sampleOpenOptions);
    const canvas = document.querySelector('.aspect-dynamics-canvas');
    canvas.getBoundingClientRect = () => ({
        left: 0,
        right: 720,
        top: 0,
        bottom: 320,
        width: 720,
        height: 320,
    });
    const wrap = document.querySelector('.aspect-dynamics-chart-wrap');
    dispatchPointer(wrap, 'pointermove', { clientX: 360, clientY: 155 });

    assert.ok(Number.isFinite(modal._state.hoverMs));
    assert.ok(modal._state.hoverMs > modal._state.interactionWindow.start);
    assert.ok(modal._state.hoverMs < modal._state.interactionWindow.end);
    assert.ok(Number.isFinite(modal._state.hoverOrb));
    assert.ok(Math.abs(modal._state.hoverOrb) < 0.1);

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(payloads.length, 2);

    dispatchPointer(wrap, 'pointerleave', { clientX: 360 });
    assert.equal(modal._state.hoverMs, null);
    assert.equal(modal._state.hoverOrb, null);
    modal.close();
});
