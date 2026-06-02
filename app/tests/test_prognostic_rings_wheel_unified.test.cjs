const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Тесты Фазы W (единый движок колеса, D6):
//  W1 — маркеры углов ASC/MC/DSC/IC (opt-in showAngleMarkers);
//  W4 — engine-level setVisibleMethods: 1 видимое кольцо = одиночная раскладка.
// Движок — ES-модуль с window-экспортом → jsdom-глобалы ставятся ДО dynamic import.

let WheelClass = null;
let dom = null;

async function loadEngine() {
    if (WheelClass) return WheelClass;
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    // Движок ссылается на голый глобал `Symbols` (в браузере — window-binding из symbols.js)
    global.Symbols = { signs: {}, planets: {} };
    await import('../frontend/js/prognostic-rings-wheel.js');
    WheelClass = dom.window.PrognosticRingsWheel;
    assert.ok(WheelClass, 'engine should export window.PrognosticRingsWheel');
    return WheelClass;
}

function makeSvg() {
    return dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

const NATAL_ANGLES = {
    ASC: { longitude: 100.0 },
    MC: { longitude: 10.0 },
    DSC: { longitude: 280.0 },
    IC: { longitude: 190.0 },
};

function natalLayer(extra) {
    return { method: 'natal', bodies: [], houses: [], aspects: [], angles: NATAL_ANGLES, ...extra };
}

function transitLayer() {
    return { method: 'transit', bodies: [], houses: [], aspects: [], style: { color: '#1e3a5f' } };
}

test('W1: angle markers are OFF by default (existing pages unchanged)', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.render({ natalLayer: natalLayer(), activePrognosticLayers: [] });
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 0);
});

test('W1: showAngleMarkers renders ASC/MC/DSC/IC lines + labels from ring.angles', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ showAngleMarkers: true });
    wheel.render({ natalLayer: natalLayer(), activePrognosticLayers: [transitLayer()] });

    const labels = Array.from(svg.querySelectorAll('.angle-marker-label')).map((n) => n.getAttribute('data-angle')).sort();
    assert.deepEqual(labels, ['ASC', 'DSC', 'IC', 'MC']);
    assert.equal(svg.querySelectorAll('.angle-marker-line').length, 4);
    // маркеры принадлежат кольцу-носителю углов (натал)
    assert.equal(svg.querySelector('.angle-marker-label').getAttribute('data-method'), 'natal');
});

test('W1: missing angles on all rings -> no markers, no crash', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ showAngleMarkers: true });
    wheel.render({ natalLayer: natalLayer({ angles: null }), activePrognosticLayers: [] });
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 0);
});

test('W4: setVisibleMethods filters rings; single visible ring gets single-chart layout', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    const vm = { natalLayer: natalLayer(), activePrognosticLayers: [transitLayer()] };
    wheel.render(vm);
    assert.equal(wheel.rings.length, 2);
    const twoRingWidth = wheel.rings[0].outer - wheel.rings[0].inner;

    wheel.setVisibleMethods(['natal']);            // re-render внутри
    assert.equal(wheel.rings.length, 1);
    assert.equal(wheel.rings[0].method, 'natal');
    const singleWidth = wheel.rings[0].outer - wheel.rings[0].inner;
    // одиночная раскладка: кольцо занимает всю доступную ширину, а не половину
    assert.ok(singleWidth > twoRingWidth * 1.5,
        `single ring (${singleWidth}) should be much wider than a 2-ring slot (${twoRingWidth})`);
});

test('W4: setVisibleMethods(null) restores all rings', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.render({ natalLayer: natalLayer(), activePrognosticLayers: [transitLayer()] });
    wheel.setVisibleMethods(['transit']);
    assert.equal(wheel.rings.length, 1);
    assert.equal(wheel.rings[0].method, 'transit');
    wheel.setVisibleMethods(null);
    assert.equal(wheel.rings.length, 2);
});

test('W4: filter that matches nothing falls back to all rings (UI desync guard)', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.render({ natalLayer: natalLayer(), activePrognosticLayers: [transitLayer()] });
    wheel.setVisibleMethods(['no-such-method']);
    assert.equal(wheel.rings.length, 2);
});

test('W3: buildViewModel adapts flat natal chartData to a renderable single-ring viewModel', async () => {
    const Wheel = await loadEngine();
    const normalizer = require('../frontend/js/prognostic-layer-normalizer.js');
    const chartData = {
        planets: [],
        houses: [],
        aspects: [],
        angles: NATAL_ANGLES,
        birth_data: { date: '1990-09-11' },
    };
    const vm = normalizer.buildViewModel(chartData, {}, { activeMethods: [] });
    assert.equal(vm.natalLayer.method, 'natal');
    assert.deepEqual(vm.activePrognosticLayers, []);
    assert.equal(vm.natalLayer.angles, NATAL_ANGLES);   // W3: углы прокинуты

    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ showAngleMarkers: true });
    wheel.render(vm);
    assert.equal(wheel.rings.length, 1);
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 4);
});

test('W3: engine falls back to ring.raw.angles when layer has no direct angles', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ showAngleMarkers: true });
    wheel.render({
        natalLayer: natalLayer({ angles: undefined, raw: { angles: NATAL_ANGLES } }),
        activePrognosticLayers: [],
    });
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 4);
});

test('W5: ChartWheelUnified adapter drives the unified engine with ChartWheel API', async () => {
    const Wheel = await loadEngine();
    // адаптер ожидает window.PrognosticRingsWheel + window.PrognosticLayerNormalizer
    dom.window.PrognosticLayerNormalizer = require('../frontend/js/prognostic-layer-normalizer.js');
    await import('../frontend/js/chart-wheel-adapter.js');
    const Adapter = dom.window.ChartWheelUnified;
    assert.ok(Adapter, 'adapter should export window.ChartWheelUnified');

    const svg = makeSvg();
    const wheel = new Adapter(svg);
    wheel.setOrientationMode('aries', { redraw: false });
    wheel.setPointScales({ planets: 1, points: 1 }, { redraw: false });
    wheel.setPlanetAnnotationOptions({ showStationary: true, showDegree: false }, { redraw: false });
    wheel.setHouseLabelOptions({ style: 'roman', outside: false }, { redraw: false });
    wheel.setAngleMarkerOptions({ ascDscBold: true, mcIcBold: true }, { redraw: false });

    wheel.draw({ planets: [], houses: [], aspects: [], angles: NATAL_ANGLES });
    assert.equal(wheel.engine.rings.length, 1, 'single chart = 1 ring');
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 4, 'angle markers on for parity');

    wheel.setAspectFilter('major');                       // redraw из кэша как у ChartWheel
    assert.equal(wheel.engine.aspectScope, 'major');
    assert.equal(wheel.engine.rings.length, 1);
});

test('W4: legacy minimumRingCount behavior preserved when no filter is applied', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ minimumRingCount: 2, alignSingleRingOuter: true });
    wheel.render({ natalLayer: natalLayer(), activePrognosticLayers: [] });
    assert.equal(wheel.rings.length, 1);
    // раскладка как в 2-кольцевом виде (страничный display-mode сегодня)
    const width = wheel.rings[0].outer - wheel.rings[0].inner;
    assert.ok(width < 100, `legacy 2-slot width expected, got ${width}`);
});
