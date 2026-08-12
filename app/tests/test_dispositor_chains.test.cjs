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

function makeCycleChart() {
    return {
        planets: [
            { name: 'Sun', sign: 'Gemini' },
            { name: 'Moon', sign: 'Taurus' },
            { name: 'Mercury', sign: 'Cancer' },
            { name: 'Venus', sign: 'Aries' },
            { name: 'Mars', sign: 'Gemini' },
            { name: 'Saturn', sign: 'Cancer' },
        ],
        houses: [
            { number: 1, sign: 'Aries', ruler_planet: 'Mars' },
            { number: 4, sign: 'Cancer', ruler_planet: 'Moon' },
            { number: 5, sign: 'Leo', ruler_planet: 'Sun' },
            { number: 10, sign: 'Capricorn', ruler_planet: 'Saturn' },
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

test('rendered compact section always keeps visible arrow markers', () => {
    const dispositorChains = setupDispositorChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    dispositorChains.render(container, makeReferenceChart(), {
        section: 'scheme',
        showArrowDirection: false,
    });

    assert.ok(container.querySelector('.dispositor-compact-lines marker path'));
    assert.ok(container.querySelector('.dispositor-compact-lines path[marker-end]'));
});

test('rendered compact section hides retrograde markers', () => {
    const dispositorChains = setupDispositorChains();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chart = makeReferenceChart();
    chart.planets = chart.planets.map((planet) => (
        planet.name === 'Mercury' ? { ...planet, retrograde: true } : planet
    ));

    dispositorChains.render(container, chart, { section: 'scheme' });

    assert.equal(container.querySelector('.dispositor-node-retro'), null);
});

test('rendered compact section uses readable rows for long cycles', () => {
    const dispositorChains = setupDispositorChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    dispositorChains.render(container, makeCycleChart(), { section: 'scheme' });

    const cycleRow = container.querySelector('.dispositor-cycle-row');
    assert.ok(cycleRow);
    assert.equal(cycleRow.querySelectorAll('.dispositor-cycle-arrow').length, 4);
    assert.equal(container.querySelector('.dispositor-cycle-table .dispositor-compact-lines'), null);
});

test('compact layout stacks multi-root groups without long diagonal connectors', () => {
    const dispositorChains = setupDispositorChains();
    const layout = dispositorChains.buildCompactLayout('Moon+Mercury+Uranus', [
        {
            finalKey: 'Moon+Mercury+Uranus',
            steps: [{ planet: 'Sun' }, { planet: 'Mars' }, { planet: 'Mercury' }],
        },
        {
            finalKey: 'Moon+Mercury+Uranus',
            steps: [{ planet: 'Venus' }, { planet: 'Moon' }],
        },
        {
            finalKey: 'Moon+Mercury+Uranus',
            steps: [{ planet: 'Jupiter' }, { planet: 'Saturn' }, { planet: 'Uranus' }],
        },
    ]);
    const maxConnectorLength = Math.max(...layout.edges.map((edge) => {
        const [x1, y1, x2, y2] = edge.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
        return Math.hypot(x2 - x1, y2 - y1);
    }));

    assert.ok(layout.width <= 230);
    assert.ok(maxConnectorLength <= 70);
    assert.equal(layout.mutualEdges.length, 0);
});

test('compact layout routes long root cycles outside the node column', () => {
    const dispositorChains = setupDispositorChains();
    const layout = dispositorChains.buildCompactLayout('Moon+Mercury+Venus+Mars', [
        {
            finalKey: 'Moon+Mercury+Venus+Mars',
            cycle: ['Mercury', 'Moon', 'Venus', 'Mars'],
            steps: [{ planet: 'Saturn' }, { planet: 'Mercury' }, { planet: 'Moon' }, { planet: 'Venus' }, { planet: 'Mars' }],
        },
        {
            finalKey: 'Moon+Mercury+Venus+Mars',
            cycle: ['Mercury', 'Moon', 'Venus', 'Mars'],
            steps: [{ planet: 'Sun' }, { planet: 'Mars' }, { planet: 'Mercury' }, { planet: 'Moon' }],
        },
    ]);
    const segments = layout.edges.flatMap((edge) => {
        const points = edge.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
        const pairs = [];
        for (let index = 0; index < points.length - 2; index += 2) {
            pairs.push({
                dx: Math.abs(points[index + 2] - points[index]),
                dy: Math.abs(points[index + 3] - points[index + 1]),
            });
        }
        return pairs;
    });

    assert.ok(layout.width <= 230);
    assert.equal(layout.mutualEdges.length, 0);
    assert.equal(segments.some((segment) => segment.dx > 30 && segment.dy > 30), false);
});

// --- exaltation scheme (фидбек астролога, п.17) --------------------------
//
// Эталон — скриншот из приложения Ксении по её же карте (она и лежит в
// makeReferenceChart): одинокая Луна-самодиспозитор, цепочка ♂→♀→☿→♄ и
// погашенный Сатурн на конце. Солнце, Юпитер, Уран и Плутон не показаны
// вовсе: экзальтации у их знаков нет и никто на них не указывает.

function buildExaltationScheme(dispositorChains, { classicalRulers = true } = {}) {
    return dispositorChains.buildHouseDispositorScheme(
        makeReferenceChart(),
        'exaltation',
        { mode: 'exaltation', showHouseRulers: true, classicalRulers },
    );
}

function chainSignatures(chains) {
    return new Set(chains.map((chain) => chain.steps.map((step) => step.planet).join('>')));
}

test('exaltation scheme keeps the house labels domicile-based', () => {
    const dispositorChains = setupDispositorChains();
    const { housesByRuler } = buildExaltationScheme(dispositorChains);

    // Экзальтация есть лишь у семи знаков; если считать дома по ней, подписи
    // почти у всех тел исчезают. Дома — свойство тела, а не вкладки.
    assert.deepEqual(housesByRuler.get('Mars'), [3, 10, 11]);
    assert.deepEqual(housesByRuler.get('Venus'), [4, 5, 9]);
    assert.deepEqual(housesByRuler.get('Mercury'), [6, 7]);
    assert.deepEqual(housesByRuler.get('Saturn'), [2]);
});

test('exaltation scheme drops bodies that are in no chain at all', () => {
    const dispositorChains = setupDispositorChains();
    const { chains } = buildExaltationScheme(dispositorChains);
    const planets = new Set(chains.flatMap((chain) => chain.steps.map((step) => step.planet)));

    ['Sun', 'Jupiter', 'Uranus', 'Pluto'].forEach((planet) => {
        assert.equal(planets.has(planet), false, `${planet} без связей не рисуется`);
    });
    const signatures = chainSignatures(chains);
    assert.ok(signatures.has('Moon'), 'Луна в собственной экзальтации остаётся отдельным узлом');
    assert.ok(signatures.has('Mars>Venus>Mercury>Saturn'));
});

test('exaltation scheme marks the dead end of a chain', () => {
    const dispositorChains = setupDispositorChains();
    const { chains } = buildExaltationScheme(dispositorChains);
    const chain = chains.find((item) => item.steps.map((step) => step.planet).join('>') === 'Mars>Venus>Mercury>Saturn');
    const layout = dispositorChains.buildCompactLayout('Saturn', [chain]);
    const byPlanet = Object.fromEntries(layout.nodes.map((node) => [node.planet, node]));

    assert.equal(byPlanet.Saturn.terminal, true, 'у Стрельца нет экзальтации — цепочка обрывается');
    assert.equal(Boolean(byPlanet.Mercury.terminal), false);
    assert.equal(Boolean(byPlanet.Mars.terminal), false);
});

test('rendered exaltation scheme dims the terminal node and hides the loners', () => {
    const dispositorChains = setupDispositorChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    dispositorChains.render(container, makeReferenceChart(), {
        section: 'scheme',
        mode: 'exaltation',
        classicalRulers: true,
    });

    const nodes = [...container.querySelectorAll('.dispositor-compact-node')];
    const planets = nodes.map((node) => node.querySelector('[data-planet]')?.dataset.planet);
    assert.equal(planets.includes('Sun'), false);
    assert.equal(planets.includes('Jupiter'), false);
    assert.equal(container.querySelectorAll('.dispositor-compact-node--terminal').length >= 1, true);
});

test('domicile scheme keeps every body and marks no dead ends', () => {
    const dispositorChains = setupDispositorChains();
    const { chains } = dispositorChains.buildHouseDispositorScheme(
        makeReferenceChart(),
        'domicile',
        { mode: 'domicile', showHouseRulers: true, classicalRulers: false },
    );
    const planets = new Set(chains.flatMap((chain) => chain.steps.map((step) => step.planet)));
    const deadEnds = chains.flatMap((chain) => chain.steps.filter((step) => !step.ruler));

    assert.equal(planets.size, 10, 'в домициле управитель есть у каждого знака');
    assert.equal(deadEnds.length, 0);
});

// --- реальная таблица достоинств аккаунта --------------------------------
//
// В настройках экзальтация роздана всем двенадцати знакам (Стрелец → Хирон,
// Скорпион → Уран, Близнецы и Лев → Плутон, Водолей → Меркурий), поэтому
// цепочка не обрывается никогда и всё стягивается в один цикл. Ровно это
// астролог и увидела на своей карте вместо одной строки.

const ACCOUNT_DIGNITIES = {
    Aries: { ruler: 'Mars', exaltation: 'Sun' },
    Taurus: { ruler: 'Venus', exaltation: 'Moon' },
    Gemini: { ruler: 'Mercury', exaltation: 'Pluto' },
    Cancer: { ruler: 'Moon', exaltation: 'Jupiter' },
    Leo: { ruler: 'Sun', exaltation: 'Pluto' },
    Virgo: { ruler: 'Mercury', co_ruler: 'Proserpina', exaltation: 'Mercury' },
    Libra: { ruler: 'Venus', co_ruler: 'Chiron', exaltation: 'Saturn' },
    Scorpio: { ruler: 'Pluto', co_ruler: 'Mars', exaltation: 'Uranus' },
    Sagittarius: { ruler: 'Jupiter', co_ruler: 'Neptune', exaltation: 'Chiron' },
    Capricorn: { ruler: 'Saturn', co_ruler: 'Uranus', exaltation: 'Mars' },
    Aquarius: { ruler: 'Uranus', co_ruler: 'Saturn', exaltation: 'Mercury' },
    Pisces: { ruler: 'Neptune', co_ruler: 'Jupiter', exaltation: 'Venus' },
};

function withAccountDignities() {
    window.accountPreferencesCache = { methodology: { dignities: { signs: ACCOUNT_DIGNITIES } } };
}

function renderScheme(dispositorChains, options) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    dispositorChains.render(container, makeReferenceChart(), { section: 'scheme', showHouseRulers: true, ...options });
    return container;
}

function rowChains(container) {
    return [...container.querySelectorAll('.dispositor-cycle-row, .dispositor-cycle-branch-row')].map((row) => (
        [...row.querySelectorAll('.dispositor-compact-node')]
            .map((node) => (node.getAttribute('aria-label') || '').split(' · ')[0])
            .join('>')
    ));
}

test('classical rulers switch also swaps the exaltation table', () => {
    const dispositorChains = setupDispositorChains();
    withAccountDignities();

    const account = dispositorChains.buildHouseDispositorScheme(makeReferenceChart(), 'exaltation', {
        mode: 'exaltation', showHouseRulers: true, classicalRulers: false,
    });
    const classical = dispositorChains.buildHouseDispositorScheme(makeReferenceChart(), 'exaltation', {
        mode: 'exaltation', showHouseRulers: true, classicalRulers: true,
    });

    // Стрелец: в таблице аккаунта экзальтирует Хирон, в классике — никто.
    assert.equal(account.chains.find((chain) => chain.start === 'Saturn').steps[0].ruler, 'Chiron');

    const classicalTail = classical.chains
        .find((chain) => chain.start === 'Mars').steps
        .at(-1);
    assert.equal(classicalTail.planet, 'Saturn');
    assert.equal(classicalTail.ruler, null, 'откат на таблицу аккаунта недопустим');

    const signatures = new Set(classical.chains.map((chain) => chain.steps.map((step) => step.planet).join('>')));
    assert.ok(signatures.has('Mars>Venus>Mercury>Saturn'), 'цепочка как в эталоне астролога');
});

test('cycle group draws every body once instead of repeating shared tails', () => {
    const dispositorChains = setupDispositorChains();
    withAccountDignities();

    const container = renderScheme(dispositorChains, { mode: 'exaltation', classicalRulers: false });
    const rows = rowChains(container);
    const bodies = [...container.querySelectorAll('.dispositor-compact-node')]
        .filter((node) => !node.classList.contains('dispositor-compact-node--repeat'))
        .map((node) => (node.getAttribute('aria-label') || '').split(' · ')[0]);

    assert.equal(new Set(bodies).size, bodies.length, `тело нарисовано дважды: ${rows.join(' | ')}`);
    // Хвост ☿→♄→⚷ раньше повторялся в четырёх строках из семи.
    assert.ok(rows.length <= 3, `строк должно остаться немного, получили ${rows.length}`);
});

test('account dignities keep the chain connected — nothing dead-ends', () => {
    const dispositorChains = setupDispositorChains();
    withAccountDignities();

    const { chains } = dispositorChains.buildHouseDispositorScheme(makeReferenceChart(), 'exaltation', {
        mode: 'exaltation', showHouseRulers: true, classicalRulers: false,
    });

    assert.equal(chains.flatMap((chain) => chain.steps).filter((step) => !step.ruler).length, 0);
});
