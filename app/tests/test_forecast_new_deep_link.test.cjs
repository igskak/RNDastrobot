const test = require('node:test');
const assert = require('node:assert/strict');

const deepLink = require('../frontend/js/forecast-new-deep-link.js');

test('direct synastry entry opens multi-wheel with no transit layer', () => {
    assert.deepEqual(deepLink.resolveLayerEntry('synastry_partner', 'partner-42'), {
        methods: ['synastry_partner'],
        wheelView: 'multi',
    });
});

test('other layer entries preserve the existing transit companion behavior', () => {
    assert.deepEqual(deepLink.resolveLayerEntry('solar_return', ''), {
        methods: ['transit', 'solar_return'],
        wheelView: null,
    });
    assert.deepEqual(deepLink.resolveLayerEntry('transit', ''), {
        methods: ['transit'],
        wheelView: null,
    });
});

test('synastry setup without a selected partner keeps the existing layer behavior', () => {
    assert.deepEqual(deepLink.resolveLayerEntry('synastry_partner', ''), {
        methods: ['transit', 'synastry_partner'],
        wheelView: null,
    });
});
