const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function setupDispositorChains() {
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.Element = dom.window.Element;

    window.FrontendI18n = {
        t(key) {
            const labels = {
                'common.house': 'House',
                'page.chart.rulers.mainKicker': 'Houses and links',
                'page.chart.rulers.modalTitle': 'Dispositor scheme',
                'page.chart.rulers.empty.noChains': 'No chains',
                'page.chart.rulers.options.arrowDirection': 'Arrow direction',
                'page.chart.rulers.options.chainType': 'Chain type',
                'page.chart.rulers.options.classicalRulers': 'Classical rulers',
                'page.chart.rulers.options.houseRulers': 'House rulers',
                'page.chart.rulers.chainModes.domicile': 'Disposition',
            };
            return labels[key] || key;
        },
    };
    window.Symbols = {
        signs: {},
        getPlanetNameRu: (name) => name,
        getPlanetSymbolMarkup: (name) => `<span data-planet="${name}">${name}</span>`,
        formatHouseList(values, options = {}) {
            const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
            const separator = Object.prototype.hasOwnProperty.call(options, 'separator') ? options.separator : ',';
            return values.map((value) => roman[value - 1] || String(value)).join(separator);
        },
    };

    const modulePath = '../frontend/js/dispositor-chains.js';
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
    return window.DispositorChains;
}

function makeReferenceChart() {
    return {
        planets: [
            { name: 'Sun', sign: 'Scorpio' },
            { name: 'Moon', sign: 'Taurus' },
            { name: 'Mercury', sign: 'Libra' },
            { name: 'Venus', sign: 'Virgo' },
            { name: 'Mars', sign: 'Pisces' },
            { name: 'Jupiter', sign: 'Gemini' },
            { name: 'Saturn', sign: 'Sagittarius' },
            { name: 'Uranus', sign: 'Sagittarius' },
            { name: 'Neptune', sign: 'Capricorn' },
            { name: 'Pluto', sign: 'Scorpio' },
        ],
        houses: [
            { number: 1, sign: 'Sagittarius', ruler_planet: 'Jupiter' },
            { number: 2, sign: 'Aquarius', ruler_planet: 'Uranus' },
            { number: 3, sign: 'Aries', ruler_planet: 'Mars' },
            { number: 4, sign: 'Taurus', ruler_planet: 'Venus' },
            { number: 5, sign: 'Taurus', ruler_planet: 'Venus' },
            { number: 6, sign: 'Gemini', ruler_planet: 'Mercury' },
            { number: 7, sign: 'Gemini', ruler_planet: 'Mercury' },
            { number: 8, sign: 'Leo', ruler_planet: 'Sun' },
            { number: 9, sign: 'Libra', ruler_planet: 'Venus' },
            { number: 10, sign: 'Scorpio', ruler_planet: 'Pluto' },
            { number: 11, sign: 'Scorpio', ruler_planet: 'Pluto' },
            { number: 12, sign: 'Sagittarius', ruler_planet: 'Jupiter' },
        ],
    };
}

test('house dispositor scheme matches the astrologer reference chain labels', () => {
    const dispositorChains = setupDispositorChains();
    const { chains, housesByRuler } = dispositorChains.buildHouseDispositorScheme(
        makeReferenceChart(),
        'domicile',
        { mode: 'domicile', showHouseRulers: true, classicalRulers: false },
    );

    assert.deepEqual(housesByRuler.get('Jupiter'), [1, 12]);
    assert.deepEqual(housesByRuler.get('Uranus'), [2]);
    assert.deepEqual(housesByRuler.get('Mars'), [3]);
    assert.deepEqual(housesByRuler.get('Venus'), [4, 5, 9]);
    assert.deepEqual(housesByRuler.get('Mercury'), [6, 7]);
    assert.deepEqual(housesByRuler.get('Sun'), [8]);
    assert.deepEqual(housesByRuler.get('Pluto'), [10, 11]);

    const signatures = new Set(chains.map((chain) => chain.steps.map((step) => step.planet).join('>')));
    assert.ok(signatures.has('Sun>Pluto'));
    assert.ok(signatures.has('Mars>Neptune>Saturn>Jupiter>Mercury>Venus'));
    assert.ok(signatures.has('Uranus>Jupiter>Mercury>Venus'));
    assert.ok(signatures.has('Moon>Venus>Mercury'));
});

test('compact layout arranges the reference chain left to right around Mercury and Venus', () => {
    const dispositorChains = setupDispositorChains();
    const { chains } = dispositorChains.buildHouseDispositorScheme(
        makeReferenceChart(),
        'domicile',
        { mode: 'domicile', showHouseRulers: true, classicalRulers: false },
    );
    const groupChains = chains.filter((chain) => chain.finalKey === 'Mercury+Venus');
    const layout = dispositorChains.buildCompactLayout('Mercury+Venus', groupChains);
    const byPlanet = Object.fromEntries(layout.nodes.map((node) => [node.planet, node]));

    assert.ok(byPlanet.Mars.x < byPlanet.Neptune.x);
    assert.ok(byPlanet.Neptune.x < byPlanet.Saturn.x);
    assert.equal(byPlanet.Saturn.x, byPlanet.Uranus.x);
    assert.ok(byPlanet.Saturn.x < byPlanet.Jupiter.x);
    assert.ok(byPlanet.Jupiter.x < byPlanet.Mercury.x);
    assert.ok(byPlanet.Mercury.x < byPlanet.Venus.x);
    assert.ok(byPlanet.Venus.x < byPlanet.Moon.x);
    assert.equal(layout.mutualEdges.length, 1);
    assert.ok(layout.width <= 620);
    assert.ok(layout.height <= 140);
});

test('rendered compact section keeps house labels under the corresponding planets', () => {
    const dispositorChains = setupDispositorChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    dispositorChains.render(container, makeReferenceChart(), { section: 'scheme' });

    const text = container.textContent.replace(/\s+/g, ' ');
    assert.match(text, /I,XII/);
    assert.match(text, /IV,V,IX/);
    assert.match(text, /VI,VII/);
    assert.match(text, /X,XI/);
    assert.equal(container.querySelectorAll('.dispositor-compact-node').length >= 10, true);
});
