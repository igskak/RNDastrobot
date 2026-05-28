const test = require('node:test');
const assert = require('node:assert/strict');

const preferences = require('../frontend/js/preferences.js');

test('getPlanetColor uses fixed body colors before element fallback', () => {
    assert.equal(preferences.getPlanetColor('Sun', 'Fire'), preferences.getPlanetColor('Sun', 'Air'));
    assert.equal(preferences.getPlanetColor('TrueNorthNode', 'Fire'), preferences.getPlanetColor('TrueNode', 'Water'));
    assert.notEqual(preferences.getPlanetColor('Sun', 'Fire'), preferences.getPlanetColor('Moon', 'Fire'));
});

test('chart view drafts round-trip through localStorage', () => {
    const storage = new Map();
    const previousLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
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

    try {
        const meta = { chart_kind: 'natal', chart_id: 'user-1', view_type: 'natal' };
        const resolved = {
            view_options: { orientation: 'asc' },
            matrix: { rows: { Sun: { display: false, aspecting: false } } },
        };

        preferences.saveChartViewDraft(meta, resolved);
        assert.deepEqual(preferences.readChartViewDraft(meta), resolved);

        preferences.clearChartViewDraft(meta);
        assert.equal(preferences.readChartViewDraft(meta), null);
    } finally {
        if (previousLocalStorage === undefined) {
            delete globalThis.localStorage;
        } else {
            globalThis.localStorage = previousLocalStorage;
        }
    }
});

test('normalizeViewSettings preserves aspect and wheel options', () => {
    const normalized = preferences.normalizeViewSettings({
        aspects: {
            scope: 'minor',
            enabled_types: [],
            show_applying_separating: false,
            phase_filter: ['applying'],
        },
        view_options: {
            orientation: 'asc',
            point_scale: 1.35,
            show_planet_stationary: true,
            show_planet_degree: true,
            house_number_style: 'roman',
            house_labels_outside: true,
            bold_asc_dsc: false,
            bold_mc_ic: false,
        },
    });

    assert.deepEqual(normalized.aspects.enabled_types, []);
    assert.equal(normalized.aspects.show_applying_separating, false);
    assert.deepEqual(normalized.aspects.phase_filter, ['applying']);
    assert.equal(normalized.view_options.point_scale, 1.35);
    assert.equal(normalized.view_options.show_planet_stationary, true);
    assert.equal(normalized.view_options.show_planet_degree, true);
    assert.equal(normalized.view_options.house_number_style, 'roman');
    assert.equal(normalized.view_options.house_labels_outside, true);
    assert.equal(normalized.view_options.bold_asc_dsc, false);
    assert.equal(normalized.view_options.bold_mc_ic, false);
});

test('filterChartDataByViewPreferences treats an empty aspect type list as hide all', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Mars' },
        ],
        aspects: [
            { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' },
        ],
        aspect_configurations: [
            {
                type: 'TestConfig',
                planets_involved: ['Sun', 'Mars'],
                aspects: [{ planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' }],
            },
        ],
        stelliums: [],
    };

    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {},
        aspectScope: 'all',
        enabledAspectTypes: [],
    });

    assert.deepEqual(filtered.aspects, []);
    assert.deepEqual(filtered.aspect_configurations, []);
});

test('resolveEnabledAspectTypesForScope keeps an explicit empty selection empty', () => {
    const enabled = preferences.resolveEnabledAspectTypesForScope({
        enabledAspectTypes: [],
        aspectScope: 'major',
        availableAspectTypes: ['Square', 'Trine'],
    });

    assert.deepEqual([...enabled], []);
});

test('filterChartDataByViewPreferences hides aspects and configurations for non-aspecting bodies', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Chiron' },
            { name: 'Mars' },
        ],
        aspects: [
            { planet_1: 'Sun', planet_2: 'Chiron', aspect_type: 'Square' },
            { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Trine' },
        ],
        aspect_configurations: [
            {
                type: 'TestConfig',
                planets_involved: ['Sun', 'Chiron', 'Mars'],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Chiron', aspect_type: 'Square' },
                    { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Trine' },
                ],
            },
        ],
        stelliums: [
            {
                type: 'sign',
                sign: 'Aries',
                planets: ['Sun', 'Chiron', 'Mars'],
                count: 3,
            },
        ],
    };

    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {
            Chiron: { display: true, aspecting: false },
        },
        enabledAspectTypes: ['Square', 'Trine'],
    });

    assert.deepEqual(filtered.planets.map((planet) => planet.name), ['Sun', 'Chiron', 'Mars']);
    assert.deepEqual(
        filtered.aspects.map((aspect) => [aspect.planet_1, aspect.planet_2, aspect.aspect_type]),
        [['Sun', 'Mars', 'Trine']],
    );
    assert.equal(filtered.aspect_configurations.length, 0);
    assert.equal(filtered.stelliums.length, 0);
});

test('filterChartDataByViewPreferences hides configurations that rely on disabled aspect types', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Mars' },
            { name: 'Jupiter' },
        ],
        aspects: [
            { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' },
            { planet_1: 'Sun', planet_2: 'Jupiter', aspect_type: 'Trine' },
        ],
        aspect_configurations: [
            {
                type: 'TestConfig',
                planets_involved: ['Sun', 'Mars', 'Jupiter'],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' },
                    { planet_1: 'Sun', planet_2: 'Jupiter', aspect_type: 'Trine' },
                ],
            },
        ],
    };

    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {},
        enabledAspectTypes: ['Trine'],
    });

    assert.deepEqual(
        filtered.aspects.map((aspect) => [aspect.planet_1, aspect.planet_2, aspect.aspect_type]),
        [['Sun', 'Jupiter', 'Trine']],
    );
    assert.equal(filtered.aspect_configurations.length, 0);
});

test('filterChartDataByViewPreferences applies matrix rows to prognostic aspect fields', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Mars' },
            { name: 'Chiron' },
        ],
        aspects: [
            {
                transit_planet: 'Mars',
                natal_object: 'Sun',
                left_planet: 'Mars',
                right_planet: 'Sun',
                aspect_type: 'Square',
            },
            {
                transit_planet: 'Chiron',
                natal_object: 'Sun',
                left_planet: 'Chiron',
                right_planet: 'Sun',
                aspect_type: 'Trine',
            },
        ],
        aspect_configurations: [],
        stelliums: [],
    };

    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {
            Chiron: { display: true, aspecting: false },
        },
        enabledAspectTypes: ['Square', 'Trine'],
    });

    assert.deepEqual(
        filtered.aspects.map((aspect) => [aspect.transit_planet, aspect.natal_object, aspect.aspect_type]),
        [['Mars', 'Sun', 'Square']],
    );
});

test('filterChartDataByViewPreferences applies separate endpoint rows to prognostic aspects', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Moon' },
            { name: 'Mars' },
        ],
        aspects: [
            {
                transit_planet: 'Sun',
                natal_object: 'Moon',
                left_planet: 'Sun',
                right_planet: 'Moon',
                aspect_type: 'Square',
            },
            {
                transit_planet: 'Mars',
                natal_object: 'Sun',
                left_planet: 'Mars',
                right_planet: 'Sun',
                aspect_type: 'Trine',
            },
        ],
        aspect_configurations: [],
        stelliums: [],
    };

    const transitSunDisabled = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {},
        aspectMatrixRows: {
            first: {
                Sun: { display: false, aspecting: false },
            },
            second: {},
        },
        enabledAspectTypes: ['Square', 'Trine'],
    });

    assert.deepEqual(
        transitSunDisabled.aspects.map((aspect) => [aspect.transit_planet, aspect.natal_object, aspect.aspect_type]),
        [['Mars', 'Sun', 'Trine']],
    );

    const natalSunDisabled = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {},
        aspectMatrixRows: {
            first: {},
            second: {
                Sun: { display: false, aspecting: false },
            },
        },
        enabledAspectTypes: ['Square', 'Trine'],
    });

    assert.deepEqual(
        natalSunDisabled.aspects.map((aspect) => [aspect.transit_planet, aspect.natal_object, aspect.aspect_type]),
        [['Sun', 'Moon', 'Square']],
    );
});

test('filterChartDataByViewPreferences treats hidden aspect endpoint as non-aspecting', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Mars' },
        ],
        aspects: [
            {
                transit_planet: 'Mars',
                natal_object: 'Sun',
                left_planet: 'Mars',
                right_planet: 'Sun',
                aspect_type: 'Square',
            },
        ],
        aspect_configurations: [],
        stelliums: [],
    };

    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {},
        aspectMatrixRows: {
            first: {
                Mars: { display: false, aspecting: true },
            },
            second: {},
        },
        enabledAspectTypes: ['Square'],
    });

    assert.deepEqual(filtered.aspects, []);
});

test('filterChartDataByViewPreferences removes hidden bodies from table house fields and special points', () => {
    const chartData = {
        planets: [
            { name: 'Sun' },
            { name: 'Mars' },
            { name: 'TrueNode' },
        ],
        houses: [
            {
                number: 1,
                ruler_planet: 'Mars',
                ruler_in_house: 5,
                co_rulers: ['Sun', 'TrueNode'],
                ruler_groups: [
                    {
                        scope: 'cusp',
                        sign: 'Aries',
                        entries: [
                            { planet: 'Mars', role: 'primary', house: 5 },
                            { planet: 'Sun', role: 'secondary', house: 9 },
                            { planet: 'TrueNode', role: 'secondary', house: 11 },
                        ],
                    },
                ],
                planets_in_house: ['Mars', 'Sun', 'TrueNode'],
            },
        ],
        special_points: {
            TrueNorthNode: { longitude: 10 },
            Fortune: { longitude: 20 },
        },
        aspects: [],
        aspect_configurations: [],
        stelliums: [],
    };

    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: {
            Mars: { display: false, aspecting: true },
            TrueNode: { display: false, aspecting: true },
        },
    });

    assert.deepEqual(filtered.planets.map((planet) => planet.name), ['Sun']);
    assert.equal(filtered.houses[0].ruler_planet, null);
    assert.equal(filtered.houses[0].ruler_in_house, null);
    assert.deepEqual(filtered.houses[0].co_rulers, ['Sun']);
    assert.deepEqual(filtered.houses[0].ruler_groups, [
        {
            scope: 'cusp',
            sign: 'Aries',
            entries: [
                { planet: 'Sun', role: 'secondary', house: 9 },
            ],
        },
    ]);
    assert.deepEqual(filtered.houses[0].planets_in_house, ['Sun']);
    assert.deepEqual(Object.keys(filtered.special_points), ['Fortune']);
});
