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
    assert.deepEqual(legacy.orbs.profiles.natal.matrix, legacy.orbs.profiles.prognostic.matrix);
    assert.equal(legacy.orbs.profiles.natal.matrix.Conjunction.Sun, 8);
});

test('normalizeMethodologySettings preserves distinct natal and prognostic profiles', () => {
    const normalized = preferences.normalizeMethodologySettings({
        orbs: {
            version: 2,
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
    assert.equal(normalized.orbs.profiles.natal.matrix.Conjunction.Sun, 7.5);
    assert.equal(normalized.orbs.profiles.prognostic.matrix.Conjunction.Sun, 5.5);
});
