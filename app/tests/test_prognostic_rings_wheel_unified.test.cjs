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

function natalHouses() {
    return Array.from({ length: 12 }, (_, index) => ({
        number: index + 1,
        longitude: index * 30,
        sign: 'Aries',
        degree_in_sign: 0,
    }));
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

test('W1: outside house labels omit angular numbers when angle markers are shown', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ showAngleMarkers: true, houseLabelsOutside: true });
    wheel.render({ natalLayer: natalLayer({ houses: natalHouses() }), activePrognosticLayers: [] });

    const labels = Array.from(svg.querySelectorAll('#prognostic-labels text'))
        .map((node) => node.textContent)
        .filter(Boolean);
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 4);
    assert.equal(labels.includes('1'), false);
    assert.equal(labels.includes('4'), false);
    assert.equal(labels.includes('7'), false);
    assert.equal(labels.includes('10'), false);
    assert.equal(labels.includes('2'), true);
    assert.equal(labels.includes('12'), true);
});

test('W1: missing angles on all rings -> no markers, no crash', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ showAngleMarkers: true });
    wheel.render({ natalLayer: natalLayer({ angles: null }), activePrognosticLayers: [] });
    assert.equal(svg.querySelectorAll('.angle-marker-label').length, 0);
});

test('W4: setVisibleMethods filters rings; single ring keeps the 2-slot thickness at the outer slot', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    const vm = { natalLayer: natalLayer(), activePrognosticLayers: [transitLayer()] };
    wheel.render(vm);
    assert.equal(wheel.rings.length, 2);
    const twoRingWidth = wheel.rings[0].outer - wheel.rings[0].inner;
    const outerSlotInner = wheel.rings[1].inner;

    wheel.setVisibleMethods(['natal']);            // re-render внутри
    assert.equal(wheel.rings.length, 1);
    assert.equal(wheel.rings[0].method, 'natal');
    const singleWidth = wheel.rings[0].outer - wheel.rings[0].inner;
    // Требование астролога: одиночное колесо ТОЙ ЖЕ толщины, что слот
    // двухкольцевой раскладки, и прижато к зодиаку (внешний слот).
    assert.ok(Math.abs(singleWidth - twoRingWidth) < 0.001,
        `single ring (${singleWidth}) must equal a 2-ring slot (${twoRingWidth})`);
    assert.ok(Math.abs(wheel.rings[0].inner - outerSlotInner) < 0.001,
        `single ring must sit at the outer slot (inner ${wheel.rings[0].inner} vs ${outerSlotInner})`);
});

test('single-layer viewModel renders with 2-slot thickness regardless of options', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.setOptions({ minimumRingCount: 1, alignSingleRingOuter: false });
    wheel.render({ natalLayer: natalLayer(), activePrognosticLayers: [] });
    const width = wheel.rings[0].outer - wheel.rings[0].inner;
    assert.ok(width < 100, `single ring must be slim (2-slot), got ${width}`);
});

test('aspect glyph renders with a backdrop under the icon', async () => {
    const Wheel = await loadEngine();
    const svg = makeSvg();
    const wheel = new Wheel(svg);
    wheel.render({
        natalLayer: natalLayer({
            bodies: [
                { name: 'Sun', longitude: 10 },
                { name: 'Moon', longitude: 130 },
            ],
            aspectBodies: [
                { name: 'Sun', longitude: 10 },
                { name: 'Moon', longitude: 130 },
            ],
            aspects: [
                { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Trine', orb: 1 },
            ],
        }),
        activePrognosticLayers: [],
    });

    const group = svg.querySelector('.aspect-symbol-group');
    assert.ok(group, 'major tight aspect should render a symbol group');
    assert.equal(group.children[0].classList.contains('aspect-symbol-backdrop'), true);
    assert.equal(group.children[1].classList.contains('aspect-symbol-text'), true);
    assert.equal(group.children[0].getAttribute('cx'), group.children[1].getAttribute('x'));
});

test('exact aspects within 25 percent of allowed orb render thicker and can be disabled', async () => {
    const Wheel = await loadEngine();
    const renderLine = (options = {}) => {
        const svg = makeSvg();
        const wheel = new Wheel(svg);
        wheel.setOptions(options);
        wheel.render({
            natalLayer: natalLayer({
                bodies: [
                    { name: 'Sun', longitude: 10 },
                    { name: 'Moon', longitude: 130 },
                ],
                aspectBodies: [
                    { name: 'Sun', longitude: 10 },
                    { name: 'Moon', longitude: 130 },
                ],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Trine', orb: 1, max_orb: 5 },
                ],
            }),
            activePrognosticLayers: [],
        });
        return svg.querySelector('.aspect-line');
    };

    const exactLine = renderLine();
    const disabledLine = renderLine({ highlightExactAspects: false });

    assert.equal(exactLine.getAttribute('data-exact'), 'true');
    assert.equal(disabledLine.getAttribute('data-exact'), 'false');
    assert.ok(
        Number(exactLine.getAttribute('stroke-width')) > Number(disabledLine.getAttribute('stroke-width')),
        'exact aspect line should be thicker than the disabled baseline',
    );
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

// NOTE: the W5 "ChartWheelUnified adapter" test was removed when chart.html /
// synastry.html (and with them chart-wheel.js + chart-wheel-adapter.js) were
// retired. forecast-new drives prognostic-rings-wheel.js directly; the adapter
// no longer exists, so there is nothing to assert parity against.

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
