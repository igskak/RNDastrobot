const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildPersistedState,
    parsePersistedState,
} = require('../frontend/js/forecast-new-state-storage.js');

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
