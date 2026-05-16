const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildPersistedState,
    MATRIX_SCHEMA_VERSION,
    parsePersistedState,
} = require('../frontend/js/forecast-new-state-storage.js');
const preferences = require('../frontend/js/preferences.js');

function makeNatalChart() {
    return {
        user_id: 'user-forecast-new',
        birth_data: {
            date: '1990-06-26',
            time: '12:34:00',
            place: 'Kyiv',
            latitude: 50.45,
            longitude: 30.523,
            house_system: 'P',
        },
    };
}

test('forecast new storage preserves a valid custom time step', () => {
    const natalData = makeNatalChart();
    const snapshot = buildPersistedState({
        natalData,
        state: {
            customStep: { amount: 12, unit: 'hour' },
        },
    });

    const restored = parsePersistedState(JSON.stringify(snapshot), natalData);
    assert.deepEqual(restored.customStep, { amount: 12, unit: 'hour' });
});

test('forecast new storage normalizes invalid custom time steps', () => {
    const natalData = makeNatalChart();
    const snapshot = buildPersistedState({
        natalData,
        state: {
            customStep: { amount: -5, unit: 'quarter' },
        },
    });

    assert.deepEqual(snapshot.customStep, { amount: 1, unit: 'day' });
});

test('forecast new storage preserves prognostic cusp visibility toggles', () => {
    const natalData = makeNatalChart();
    const snapshot = buildPersistedState({
        natalData,
        state: {
            pageSettings: {
                showTransitCusps: false,
                showProgressionCusps: true,
                showDirectionCusps: false,
            },
        },
    });

    const restored = parsePersistedState(JSON.stringify(snapshot), natalData);
    assert.equal(restored.pageSettings.showTransitCusps, false);
    assert.equal(restored.pageSettings.showProgressionCusps, true);
    assert.equal(restored.pageSettings.showDirectionCusps, false);
});

test('forecast new storage preserves separate natal and prognostic matrix rows', () => {
    const natalData = makeNatalChart();
    const snapshot = buildPersistedState({
        natalData,
        state: {
            natalMatrixRows: {
                Sun: { display: true, aspecting: false },
            },
            matrixRows: {
                Sun: { display: false, aspecting: true },
            },
        },
    });

    const restored = parsePersistedState(JSON.stringify(snapshot), natalData);
    assert.equal(restored.matrixSchemaVersion, MATRIX_SCHEMA_VERSION);
    assert.deepEqual(restored.natalMatrixRows.Sun, { display: true, aspecting: false });
    assert.deepEqual(restored.matrixRows.Sun, { display: false, aspecting: true });
});

test('forecast new storage preserves independent natal and prognostic toggles for every matrix body', () => {
    const natalData = makeNatalChart();
    const natalMatrixRows = {};
    const matrixRows = {};

    preferences.MATRIX_BODIES.forEach((body, index) => {
        natalMatrixRows[body] = {
            display: index % 2 === 0,
            aspecting: index % 3 === 0,
        };
        matrixRows[body] = {
            display: index % 2 !== 0,
            aspecting: index % 3 !== 0,
        };
    });

    const snapshot = buildPersistedState({
        natalData,
        state: {
            natalMatrixRows,
            matrixRows,
        },
    });

    const restored = parsePersistedState(JSON.stringify(snapshot), natalData);

    preferences.MATRIX_BODIES.forEach((body) => {
        assert.deepEqual(restored.natalMatrixRows[body], natalMatrixRows[body], `natal matrix row mismatch for ${body}`);
        assert.deepEqual(restored.matrixRows[body], matrixRows[body], `prognostic matrix row mismatch for ${body}`);
    });
});
