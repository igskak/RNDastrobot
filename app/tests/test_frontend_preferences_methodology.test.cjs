const test = require('node:test');
const assert = require('node:assert/strict');

const preferences = require('../frontend/js/preferences.js');

test('normalizeMethodologySettings expands legacy orb matrix into natal and prognostic profiles', () => {
    const legacy = preferences.normalizeMethodologySettings({
        orbs: {
            version: 1,
            matrix: {
                Conjunction: {
                    Sun: 8,
                },
            },
        },
    });

    assert.equal(legacy.orbs.version, 2);
    assert.equal(legacy.orbs.pair_strategy, 'larger');
    assert.deepEqual(legacy.orbs.profiles.natal.matrix, legacy.orbs.profiles.prognostic.matrix);
    assert.equal(legacy.orbs.profiles.natal.matrix.Conjunction.Sun, 8);
});

test('normalizeMethodologySettings preserves distinct natal and prognostic profiles', () => {
    const normalized = preferences.normalizeMethodologySettings({
        orbs: {
            version: 2,
            pair_strategy: 'average',
            profiles: {
                natal: {
                    matrix: {
                        Conjunction: { Sun: 7.5 },
                    },
                },
                prognostic: {
                    matrix: {
                        Conjunction: { Sun: 5.5 },
                    },
                },
            },
        },
    });

    assert.equal(normalized.orbs.version, 2);
    assert.equal(normalized.orbs.pair_strategy, 'average');
    assert.equal(normalized.orbs.profiles.natal.matrix.Conjunction.Sun, 7.5);
    assert.equal(normalized.orbs.profiles.prognostic.matrix.Conjunction.Sun, 5.5);
    assert.equal(normalized.stationary.threshold_percent, 10);
});

test('normalizeMethodologySettings keeps custom stationary threshold', () => {
    const normalized = preferences.normalizeMethodologySettings({
        stationary: {
            threshold_percent: 7.5,
        },
    });

    assert.equal(normalized.stationary.threshold_percent, 7.5);
});

test('normalizeDignitySettings merges defaults and removes duplicate co-ruler', () => {
    const normalized = preferences.normalizeDignitySettings(
        {
            signs: {
                Aries: { ruler: 'Mars', co_ruler: 'Mars' },
                Libra: { ruler: 'Venus' },
            },
        },
        {
            version: 1,
            signs: {
                Aries: { ruler: 'Mars', co_ruler: null, exaltation: 'Sun' },
                Libra: { ruler: 'Venus', co_ruler: 'Chiron', exaltation: 'Saturn' },
            },
        },
    );

    assert.equal(normalized.signs.Aries.ruler, 'Mars');
    assert.equal(normalized.signs.Aries.co_ruler, null);
    assert.equal(normalized.signs.Aries.exaltation, 'Sun');
    assert.equal(normalized.signs.Libra.co_ruler, 'Chiron');
});

test('buildDefaultOrbProfileMatrix uses fixed prognostic defaults', () => {
    const aspectTypes = [
        { aspect_type: 'Conjunction', base_orb: 8 },
        { aspect_type: 'Square', base_orb: 6 },
    ];
    const bodies = ['Sun', 'Moon', 'Mars'];

    const natalMatrix = preferences.buildDefaultOrbProfileMatrix(aspectTypes, bodies, 'natal');
    const prognosticMatrix = preferences.buildDefaultOrbProfileMatrix(aspectTypes, bodies, 'prognostic');

    assert.equal(natalMatrix.Conjunction.Sun, 8);
    assert.equal(natalMatrix.Square.Moon, 6);
    assert.equal(prognosticMatrix.Conjunction.Sun, 1);
    assert.equal(prognosticMatrix.Conjunction.Moon, 3);
    assert.equal(prognosticMatrix.Square.Mars, 1);
});

test('resolveVisualPreferences keeps explicit aspect colors and getAspectColor ignores harmony groups', () => {
    const visual = preferences.resolveVisualPreferences({
        aspect_colors: {
            Square: '#123456',
            CustomAspect: '#abcdef',
        },
    });

    assert.equal(preferences.getAspectHarmonyType('Square'), 'tense');
    assert.equal(preferences.getAspectColor('Square', visual, 'tense'), '#123456');
    assert.equal(preferences.getAspectColor('UnknownAspect', visual, 'tense'), '#9ca3af');
    assert.equal(preferences.getAspectColor('CustomAspect', visual, 'neutral'), '#abcdef');
});

test('resolveVisualPreferences uses chart-default element palette', () => {
    const visual = preferences.resolveVisualPreferences({});

    assert.equal(visual.planet_colors.element_palette.Fire, '#ef4444');
    assert.equal(visual.planet_colors.element_palette.Earth, '#84cc16');
    assert.equal(visual.planet_colors.element_palette.Air, '#f59e0b');
    assert.equal(visual.planet_colors.element_palette.Water, '#3b82f6');
    assert.equal(visual.timezone_label_format, 'UTC');
});

test('resolveVisualPreferences normalizes timezone label format', () => {
    assert.equal(preferences.resolveVisualPreferences({ timezone_label_format: 'gmt' }).timezone_label_format, 'GMT');
    assert.equal(preferences.resolveVisualPreferences({ timezone_label_format: 'utc' }).timezone_label_format, 'UTC');
    assert.equal(preferences.resolveVisualPreferences({ timezone_label_format: 'weird' }).timezone_label_format, 'UTC');
    assert.equal(preferences.getTimezoneLabelFormat({ timezone_label_format: 'gmt' }), 'GMT');
});
