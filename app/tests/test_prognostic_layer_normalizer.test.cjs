const test = require('node:test');
const assert = require('node:assert/strict');

const normalizer = require('../frontend/js/prognostic-layer-normalizer.js');

test('transit layer keeps houses empty when transit payload has no house cusps', () => {
    const natalData = {
        planets: [],
        aspects: [],
        houses: [
            { number: 1, longitude: 10, sign: 'Aries', degree_in_sign: 10 },
            { number: 2, longitude: 40, sign: 'Taurus', degree_in_sign: 10 },
        ],
    };
    const transitData = {
        transit_planets: [
            { name: 'Mars', longitude: 15, natal_house: 1 },
        ],
        aspects: [],
    };

    const viewModel = normalizer.buildViewModel(natalData, { transit: transitData }, { activeMethods: ['transit'] });
    const transitLayer = viewModel.activePrognosticLayers[0];

    assert.deepEqual(transitLayer.houses, []);
    assert.equal(transitLayer.bodies[0].house, 1);
});

test('transit layer prefers explicit transit houses when backend provides them', () => {
    const natalData = {
        planets: [],
        aspects: [],
        houses: [{ number: 1, longitude: 10, sign: 'Aries', degree_in_sign: 10 }],
    };
    const transitHouses = [{ number: 1, longitude: 20, sign: 'Aries', degree_in_sign: 20 }];

    const viewModel = normalizer.buildViewModel(
        natalData,
        { transit: { transit_planets: [], transit_houses: transitHouses, aspects: [] } },
        { activeMethods: ['transit'] },
    );

    assert.deepEqual(viewModel.activePrognosticLayers[0].houses, transitHouses);
});
