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
    assert.equal(normalized.stationary.threshold_percent, 5);
});

test('normalizeMethodologySettings keeps custom stationary threshold', () => {
    const normalized = preferences.normalizeMethodologySettings({
        stationary: {
            threshold_percent: 7.5,
        },
    });

    assert.equal(normalized.stationary.threshold_percent, 7.5);
});

test('resolveVisualPreferences keeps harmony colors and getAspectColor falls back to harmony type', () => {
    const visual = preferences.resolveVisualPreferences({
        aspect_harmony_colors: {
            tense: '#123456',
        },
        aspect_colors: {
            CustomAspect: '#abcdef',
        },
    });

    assert.equal(visual.aspect_harmony_colors.tense, '#123456');
    assert.equal(preferences.getAspectHarmonyType('Square'), 'tense');
    assert.equal(preferences.getAspectColor('UnknownAspect', visual, 'tense'), '#123456');
    assert.equal(preferences.getAspectColor('CustomAspect', visual, 'neutral'), '#abcdef');
});
