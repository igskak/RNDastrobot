const test = require('node:test');
const assert = require('node:assert/strict');

const aspectPhase = require('../frontend/js/aspect-phase.js');

test('aspect phase filter does not hide aspects without phase metadata', () => {
    const filtered = aspectPhase.filterChartDataByAspectPhase({
        aspects: [
            { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square' },
        ],
    }, 'applying');

    assert.equal(filtered.aspects.length, 1);
});

test('aspect phase filter preserves configurations when phase metadata is absent', () => {
    const filtered = aspectPhase.filterChartDataByAspectPhase({
        aspect_configurations: [
            {
                type: 'TestConfig',
                planets_involved: ['Sun', 'Moon', 'Mars'],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square' },
                    { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Trine' },
                ],
            },
        ],
    }, 'applying');

    assert.equal(filtered.aspect_configurations.length, 1);
    assert.equal(filtered.aspect_configurations[0].aspects.length, 2);
});

test('aspect phase filter keeps only matching typed aspects and configurations', () => {
    const filtered = aspectPhase.filterChartDataByAspectPhase({
        aspects: [
            { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square', applying: true },
            { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Trine', applying: false },
        ],
        aspect_configurations: [
            {
                type: 'ApplyingConfig',
                planets_involved: ['Sun', 'Moon', 'Mars'],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square', applying: true },
                ],
            },
            {
                type: 'SeparatingConfig',
                planets_involved: ['Sun', 'Moon', 'Mars'],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Trine', applying: false },
                ],
            },
        ],
    }, 'applying');

    assert.deepEqual(
        filtered.aspects.map((aspect) => aspect.aspect_type),
        ['Square'],
    );
    assert.deepEqual(
        filtered.aspect_configurations.map((configuration) => configuration.type),
        ['ApplyingConfig'],
    );
});

test('aspect phase inference derives applying and separating from body speeds', () => {
    const chartData = {
        planets: [
            { name: 'Sun', longitude: 0, speed: 1 },
            { name: 'Moon', longitude: 80, speed: 13 },
            { name: 'Mars', longitude: 100, speed: 2 },
        ],
        aspects: [
            { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square' },
            { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' },
        ],
    };

    const enriched = aspectPhase.enrichChartDataWithAspectPhases(chartData);

    assert.equal(enriched.aspects[0].applying, true);
    assert.equal(enriched.aspects[1].applying, false);
});

test('aspect phase filter uses inferred phase metadata when explicit flags are absent', () => {
    const filtered = aspectPhase.filterChartDataByAspectPhase({
        planets: [
            { name: 'Sun', longitude: 0, speed: 1 },
            { name: 'Moon', longitude: 80, speed: 13 },
            { name: 'Mars', longitude: 100, speed: 2 },
        ],
        aspects: [
            { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square' },
            { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' },
        ],
        aspect_configurations: [
            {
                type: 'MixedConfig',
                planets_involved: ['Sun', 'Moon', 'Mars'],
                aspects: [
                    { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square' },
                    { planet_1: 'Sun', planet_2: 'Mars', aspect_type: 'Square' },
                ],
            },
        ],
    }, 'applying');

    assert.deepEqual(
        filtered.aspects.map((aspect) => [aspect.planet_1, aspect.planet_2]),
        [['Sun', 'Moon']],
    );
    assert.equal(filtered.aspect_configurations.length, 1);
    assert.deepEqual(
        filtered.aspect_configurations[0].aspects.map((aspect) => [aspect.planet_1, aspect.planet_2]),
        [['Sun', 'Moon']],
    );
});
