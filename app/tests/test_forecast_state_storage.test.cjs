const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildStorageKey,
    buildPersistedState,
    parsePersistedState,
} = require('../frontend/js/forecast-state-storage.js');

function makeNatalChart(overrides = {}) {
    return {
        user_id: 'user-1',
        birth_data: {
            date: '1990-06-26',
            time: '12:34:00',
            place: 'Kyiv',
            latitude: 50.45,
            longitude: 30.523,
            house_system: 'P',
            ...overrides.birth_data,
        },
        ...overrides,
    };
}

test('buildStorageKey stays stable for one chart and changes for another', () => {
    const natalChart = makeNatalChart();
    const sameChart = makeNatalChart();
    const otherChart = makeNatalChart({
        birth_data: {
            date: '1991-01-17',
            time: '08:00:00',
        },
    });

    assert.equal(buildStorageKey(natalChart), buildStorageKey(sameChart));
    assert.notEqual(buildStorageKey(natalChart), buildStorageKey(otherChart));
});

test('buildPersistedState normalizes invalid forecast values', () => {
    const natalChart = makeNatalChart();
    const snapshot = buildPersistedState({
        natalData: natalChart,
        state: {
            currentTab: 'unknown',
            isFocusMode: true,
            transitScaleUnit: 'quarter',
            transitScaleIndex: -5,
            transitMoment: 'bad-date',
            pendingBiwheelDate: '2026-03-18',
            directionType: 'wrong',
            biwheelDisplayMode: 'natal-peek',
            tableSortCol: 'bad',
            tableSortAsc: false,
            hasCalculatedState: true,
            activeRunId: 'run-1',
            activeRunMethod: 'transits',
            cachedData: {
                tableDataKey: 'combined_table|2026-03-18|solar_arc|2026-03-10|2026-03-18',
            },
        },
        controls: {
            startDate: '2026-03-10',
            endDate: 'invalid',
            singleDate: '2026-03-18',
            filterMajor: false,
        },
    });

    assert.equal(snapshot.currentTab, 'biwheel');
    assert.equal(snapshot.transitScaleUnit, 'week');
    assert.equal(snapshot.transitScaleIndex, 0);
    assert.equal(snapshot.transitMoment, '');
    assert.equal(snapshot.pendingBiwheelDate, '2026-03-18');
    assert.equal(snapshot.directionType, 'zodiacal');
    assert.equal(snapshot.biwheelDisplayMode, 'prognostic');
    assert.equal(snapshot.tableSortCol, 'date');
    assert.equal(snapshot.tableSortAsc, false);
    assert.equal(snapshot.hasCalculatedState, true);
    assert.equal(snapshot.activeRunId, 'run-1');
    assert.equal(snapshot.activeRunMethod, 'transits');
    assert.deepEqual(snapshot.cachedData, {
        tableDataKey: 'combined_table|2026-03-18|solar_arc|2026-03-10|2026-03-18',
    });
    assert.deepEqual(snapshot.controls, {
        startDate: '2026-03-10',
        endDate: '',
        singleDate: '2026-03-18',
        filterMajor: false,
    });
});

test('direction type storage normalizes legacy symbolic to zodiacal', () => {
    const natalChart = makeNatalChart();
    const snapshot = buildPersistedState({
        natalData: natalChart,
        state: {
            directionType: 'symbolic',
        },
    });

    assert.equal(snapshot.directionType, 'zodiacal');
});

test('parsePersistedState restores only snapshots for the same chart', () => {
    const natalChart = makeNatalChart();
    const otherChart = makeNatalChart({
        user_id: 'user-2',
        birth_data: {
            time: '06:00:00',
        },
    });

    const snapshot = buildPersistedState({
        natalData: natalChart,
        state: {
            currentTab: 'timeline',
            transitScaleUnit: 'day',
            transitScaleIndex: 3,
            transitMoment: '2026-03-18',
            directionType: 'equatorial',
            biwheelDisplayMode: 'natal-pinned',
            hasCalculatedState: true,
            activeRunId: 'run-2',
            activeRunMethod: 'directions',
            cachedData: {
                transitPeriodKey: '2026-03-01|2026-03-31',
                transitEvents: { events: [{ id: 1 }] },
            },
        },
        controls: {
            startDate: '2026-03-01',
            endDate: '2026-03-31',
            singleDate: '2026-03-18',
            filterMajor: true,
        },
    });

    const restored = parsePersistedState(JSON.stringify(snapshot), natalChart);
    assert.equal(restored.currentTab, 'timeline');
    assert.equal(restored.transitScaleUnit, 'day');
    assert.equal(restored.transitScaleIndex, 3);
    assert.equal(restored.directionType, 'equatorial');
    assert.equal(restored.biwheelDisplayMode, 'natal-pinned');
    assert.equal(restored.activeRunId, 'run-2');
    assert.equal(restored.activeRunMethod, 'directions');
    assert.equal(restored.controls.endDate, '2026-03-31');
    assert.deepEqual(restored.cachedData, {
        transitPeriodKey: '2026-03-01|2026-03-31',
        transitEvents: { events: [{ id: 1 }] },
    });

    assert.equal(parsePersistedState(JSON.stringify(snapshot), otherChart), null);
});
