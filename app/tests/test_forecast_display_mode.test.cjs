const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeForecastDisplayMode,
    reduceForecastDisplayMode,
    isEditableControlTarget,
} = require('../frontend/js/forecast-display-mode.js');

test('normalizeForecastDisplayMode keeps peek only in runtime mode and strips it for persisted state', () => {
    assert.equal(normalizeForecastDisplayMode('natal-peek'), 'natal-peek');
    assert.equal(
        normalizeForecastDisplayMode('natal-peek', { persisted: true }),
        'prognostic'
    );
    assert.equal(
        normalizeForecastDisplayMode('natal-pinned', { persisted: true }),
        'natal-pinned'
    );
});

test('reduceForecastDisplayMode handles peek and pin transitions', () => {
    assert.equal(reduceForecastDisplayMode('prognostic', 'peek-on'), 'natal-peek');
    assert.equal(reduceForecastDisplayMode('natal-peek', 'peek-off'), 'prognostic');
    assert.equal(reduceForecastDisplayMode('prognostic', 'toggle-pin'), 'natal-pinned');
    assert.equal(reduceForecastDisplayMode('natal-pinned', 'toggle-pin'), 'prognostic');
    assert.equal(reduceForecastDisplayMode('natal-pinned', 'peek-on'), 'natal-pinned');
    assert.equal(reduceForecastDisplayMode('natal-peek', 'escape'), 'prognostic');
});

test('isEditableControlTarget detects editable controls only', () => {
    const inputTarget = {
        nodeType: 1,
        tagName: 'INPUT',
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
    };
    const plainTarget = {
        nodeType: 1,
        tagName: 'BUTTON',
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
    };

    assert.equal(isEditableControlTarget(inputTarget), true);
    assert.equal(isEditableControlTarget(plainTarget), false);
});
