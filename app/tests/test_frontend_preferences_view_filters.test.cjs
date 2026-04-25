const test = require('node:test');
const assert = require('node:assert/strict');

const preferences = require('../frontend/js/preferences.js');

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
