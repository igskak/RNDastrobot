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

test('solar return layer normalizes solar bodies, houses, and natal aspects', () => {
    const natalData = {
        planets: [{ name: 'Sun', longitude: 95 }],
        aspects: [],
        houses: [{ number: 1, longitude: 10, sign: 'Aries', degree_in_sign: 10 }],
    };
    const solarHouses = [{ number: 1, longitude: 24, sign: 'Aries', degree_in_sign: 24 }];
    const solarBalances = {
        by_sign: {
            element_balance: { Fire: 4, Earth: 2, Air: 3, Water: 1 },
        },
        by_house: {
            house_group_balance: { angular: 5, succedent: 3, cadent: 2 },
        },
    };
    const solarConfigurations = [{
        type: 'T_Square',
        planets_involved: ['Mars', 'Sun', 'Moon'],
        aspects: [],
    }];
    const solarStelliums = [{
        type: 'sign',
        sign: 'Leo',
        planets: ['Sun', 'Mercury', 'Venus'],
        count: 3,
    }];
    const solarPattern = { pattern_type: 'Bucket', handle_planet: 'Mars' };
    const solarData = {
        planets: [{ name: 'Mars', longitude: 120, house: 4 }],
        houses: solarHouses,
        aspects_to_natal: [
            {
                solar_planet: 'Mars',
                natal_object: 'Sun',
                aspect_type: 'Square',
                orb: 1.2,
                is_major: true,
            },
        ],
        balances: solarBalances,
        aspect_configurations: solarConfigurations,
        stelliums: solarStelliums,
        cosmogram_pattern: solarPattern,
    };

    const viewModel = normalizer.buildViewModel(
        natalData,
        { solar_return: solarData },
        { activeMethods: ['solar_return'] },
    );
    const solarLayer = viewModel.activePrognosticLayers[0];

    assert.equal(solarLayer.method, 'solar_return');
    assert.equal(solarLayer.label, 'Соляр');
    assert.deepEqual(solarLayer.houses, solarHouses);
    assert.equal(solarLayer.bodies[0].name, 'Mars');
    assert.equal(solarLayer.aspects[0].planet_1, 'Mars');
    assert.equal(solarLayer.aspects[0].planet_2, 'Sun');
    assert.equal(solarLayer.aspects[0].method, 'solar_return');
    assert.deepEqual(solarLayer.balances, solarBalances);
    assert.deepEqual(solarLayer.aspect_configurations, solarConfigurations);
    assert.deepEqual(solarLayer.stelliums, solarStelliums);
    assert.deepEqual(solarLayer.cosmogram_pattern, solarPattern);
});

test('synastry partner layer normalizes partner bodies, houses, and inter-aspects toward natal', () => {
    const natalData = {
        planets: [{ name: 'Sun', longitude: 95 }],
        aspects: [],
        houses: [{ number: 1, longitude: 10, sign: 'Aries', degree_in_sign: 10 }],
    };
    const partnerHouses = [{ number: 1, longitude: 240, sign: 'Sagittarius', degree_in_sign: 0 }];
    const partnerChart = {
        planets: [{ name: 'Moon', longitude: 121, house: 7 }],
        houses: partnerHouses,
    };
    const viewModel = normalizer.buildViewModel(
        natalData,
        {
            synastry_partner: {
                partner_chart: partnerChart,
                inter_aspects: [
                    {
                        planet_1: 'Sun',
                        planet_2: 'Moon',
                        aspect_type: 'Square',
                        orb: 1.2,
                        is_major: true,
                    },
                ],
            },
        },
        { activeMethods: ['synastry_partner'] },
    );
    const partnerLayer = viewModel.activePrognosticLayers[0];

    assert.equal(partnerLayer.method, 'synastry_partner');
    assert.equal(partnerLayer.label, 'Партнёр');
    assert.deepEqual(partnerLayer.houses, partnerHouses);
    assert.equal(partnerLayer.bodies[0].name, 'Moon');
    assert.equal(partnerLayer.aspects[0].planet_1, 'Moon');
    assert.equal(partnerLayer.aspects[0].planet_2, 'Sun');
    assert.equal(partnerLayer.aspects[0].method, 'synastry_partner');
});

test('synastry partner layer deduplicates prepared special points by canonical body name', () => {
    const viewModel = normalizer.buildViewModel(
        { planets: [{ name: 'Sun', longitude: 95 }], aspects: [], houses: [] },
        {
            synastry_partner: {
                partner_chart: {
                    planets: [
                        { name: 'Moon', longitude: 121 },
                        { name: 'TrueNode', longitude: 20 },
                    ],
                    special_points: {
                        TrueNorthNode: { name: 'TrueNorthNode', longitude: 20 },
                        Fortune: { name: 'Fortune', longitude: 75 },
                    },
                    houses: [],
                },
                inter_aspects: [],
            },
        },
        { activeMethods: ['synastry_partner'] },
    );

    const names = viewModel.activePrognosticLayers[0].bodies.map((body) => body.name);
    assert.deepEqual(names, ['Moon', 'TrueNode', 'PartOfFortune']);
});

test('natal layer exposes angles and special points for cross-wheel aspect lookup', () => {
    const natalData = {
        planets: [{ name: 'Sun', longitude: 95 }],
        special_points: {
            TrueNorthNode: { name: 'TrueNorthNode', longitude: 20 },
        },
        angles: {
            ASC: { name: 'ASC', longitude: 10 },
            MC: { name: 'MC', longitude: 280 },
        },
        aspects: [],
        houses: [],
    };

    const viewModel = normalizer.buildViewModel(natalData, {}, { activeMethods: [] });
    const visualBodyNames = viewModel.natalLayer.bodies.map((body) => body.name);
    const aspectBodyNames = viewModel.natalLayer.aspectBodies.map((body) => body.name);

    assert.deepEqual(visualBodyNames, ['Sun']);
    assert.deepEqual(aspectBodyNames, ['Sun', 'TrueNode', 'ASC', 'MC']);
});
