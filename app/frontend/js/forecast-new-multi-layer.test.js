/**
 * Regression harness for multi-instance prognostic layers (Ship 1).
 * Run from app/: node frontend/js/forecast-new-multi-layer.test.js
 *
 * Covers the three modules that moved from "method = identity" to
 * "layer = instance with own id":
 *   - prognostic-layer-normalizer.buildViewModel: keys layers by instance id and
 *     allows two layers of the same method (two transits → two ring layers).
 *   - forecast-new-state-storage.sanitizeLayerList: migrates legacy string arrays,
 *     keeps duplicates of multi-instance methods, generates unique ids.
 *   - prognostic-rings-wheel.buildRings (via tint): two same-method rings get
 *     distinct colors.
 */
'use strict';
const path = require('path');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

// --- normalizer: instance-keyed, duplicate methods allowed ---
(() => {
    const Norm = require('./prognostic-layer-normalizer.js');
    const natal = { planets: [], houses: [], aspects: [] };
    const layers = {
        'transit-1': { transit_planets: [{ name: 'Mars', longitude: 10 }], aspects: [] },
        'transit-2': { transit_planets: [{ name: 'Venus', longitude: 20 }], aspects: [] },
    };
    const vm = Norm.buildViewModel(natal, layers, {
        activeInstances: [
            { id: 'transit-1', method: 'transit' },
            { id: 'transit-2', method: 'transit' },
        ],
    });
    ok(vm.activePrognosticLayers.length === 2, 'normalizer: two transit instances → two layers');
    ok(vm.activePrognosticLayers[0].id === 'transit-1', 'normalizer: first layer carries its instance id');
    ok(vm.activePrognosticLayers[1].id === 'transit-2', 'normalizer: second layer carries its instance id');
    ok(vm.activePrognosticLayers.every((l) => l.method === 'transit'), 'normalizer: both layers are transit');
    ok(vm.activePrognosticLayers[0].ringIndex !== vm.activePrognosticLayers[1].ringIndex,
        'normalizer: instances get distinct ringIndex');

    // backward-compat: activeMethods (legacy) still works, id === method
    const vmLegacy = Norm.buildViewModel(natal, { transit: layers['transit-1'] }, { activeMethods: ['transit'] });
    ok(vmLegacy.activePrognosticLayers.length === 1 && vmLegacy.activePrognosticLayers[0].id === 'transit',
        'normalizer: legacy activeMethods path keeps id === method');
})();

// --- storage: sanitizeLayerList migration + duplicates ---
(() => {
    // sanitizeLayerList is module-private; exercise it through the public
    // buildPersistedState/parsePersistedState round-trip.
    const Storage = require('./forecast-new-state-storage.js');
    const natalData = { user_id: 'u1', birth_data: { date: '1990-01-01', time: '12:00:00', place: 'X' } };

    // legacy string array migrates to instances {id, method}
    const persistedLegacy = Storage.buildPersistedState({
        natalData,
        state: { activeLayers: ['transit', 'progression'] },
    });
    ok(Array.isArray(persistedLegacy.activeLayers)
        && persistedLegacy.activeLayers.every((l) => l && l.id && l.method),
        'storage: legacy string array migrates to {id, method} instances');

    // duplicate multi-instance methods survive with unique ids
    const persistedDup = Storage.buildPersistedState({
        natalData,
        state: {
            activeLayers: [
                { id: 'transit-1', method: 'transit' },
                { id: 'transit-2', method: 'transit' },
            ],
            selectedRightLayerId: 'transit-2',
        },
    });
    ok(persistedDup.activeLayers.length === 2, 'storage: two transit instances persist (no dedup by method)');
    const ids = persistedDup.activeLayers.map((l) => l.id);
    ok(new Set(ids).size === 2, 'storage: instance ids stay unique');
    ok(persistedDup.selectedRightLayerId === 'transit-2', 'storage: selectedRightLayerId round-trips');

    // colliding ids get regenerated to stay unique
    const persistedCollide = Storage.buildPersistedState({
        natalData,
        state: {
            activeLayers: [
                { id: 'transit-1', method: 'transit' },
                { id: 'transit-1', method: 'transit' },
            ],
        },
    });
    ok(new Set(persistedCollide.activeLayers.map((l) => l.id)).size === 2,
        'storage: duplicate ids are regenerated to be unique');

    // Ship 2: per-instance config (solar year/location, synastry partner) round-trips
    const persistedCfg = Storage.buildPersistedState({
        natalData,
        state: {
            activeLayers: [
                { id: 'solar_return-1', method: 'solar_return', config: { year: 2030, location: { name: 'Kyiv', latitude: 50.45, longitude: 30.52 } } },
                { id: 'solar_return-2', method: 'solar_return', config: { year: 2031, location: null } },
                { id: 'synastry_partner-1', method: 'synastry_partner', config: { mode: 'db', partnerId: 'p123', manual: null } },
            ],
        },
    });
    const sr1 = persistedCfg.activeLayers.find((l) => l.id === 'solar_return-1');
    const sr2 = persistedCfg.activeLayers.find((l) => l.id === 'solar_return-2');
    const syn = persistedCfg.activeLayers.find((l) => l.id === 'synastry_partner-1');
    ok(sr1.config.year === 2030 && sr1.config.location.name === 'Kyiv',
        'storage: solar instance keeps its own year + location');
    ok(sr2.config.year === 2031 && sr2.config.location === null,
        'storage: a second solar instance keeps a distinct year');
    ok(syn.config.mode === 'db' && syn.config.partnerId === 'p123',
        'storage: synastry instance keeps its own partner config');

    // round-trip through parse keeps configs
    const reparsed = Storage.parsePersistedState(JSON.stringify(persistedCfg), natalData);
    ok(reparsed.activeLayers.find((l) => l.id === 'solar_return-1').config.year === 2030,
        'storage: per-instance config survives parse round-trip');
})();

// --- wheel: two same-method rings get distinct (tinted) colors ---
(() => {
    const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
    global.window = dom.window;
    global.document = dom.window.document;
    dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
    const rect = () => ({ x: 0, y: 0, width: 300, height: 300, top: 0, left: 0, right: 300, bottom: 300 });
    dom.window.SVGElement.prototype.getBoundingClientRect = rect;
    dom.window.Element.prototype.getBoundingClientRect = rect;
    dom.window.Symbols = {};
    const bundled = require('esbuild').buildSync({
        entryPoints: [path.join(__dirname, 'prognostic-rings-wheel.js')],
        bundle: true, format: 'iife', platform: 'browser', write: false,
    }).outputFiles[0].text;
    dom.window.eval(`var Symbols = window.Symbols || {};\n${bundled}`);
    const Wheel = dom.window.PrognosticRingsWheel;

    const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dom.window.document.body.appendChild(svg);
    const wheel = new Wheel(svg);
    const mkLayer = (id, color) => ({
        id, method: 'transit', label: 'T', bodies: [], aspectBodies: [],
        houses: [], aspects: [], raw: {}, style: { color },
    });
    const rings = wheel.buildRings({
        natalLayer: { id: 'natal', method: 'natal', bodies: [], houses: [], aspects: [], style: { color: '#111111' } },
        activePrognosticLayers: [mkLayer('transit-1', '#1e3a5f'), mkLayer('transit-2', '#1e3a5f')],
    });
    const transitRings = rings.filter((r) => r.method === 'transit');
    ok(transitRings.length === 2, 'wheel: two transit rings built');
    ok(transitRings[0].color !== transitRings[1].color, 'wheel: same-method rings get distinct tinted colors');
    ok(transitRings[0].color === '#1e3a5f', 'wheel: first instance keeps the base method color');
    ok(transitRings[0].instanceIndex === 0 && transitRings[1].instanceIndex === 1,
        'wheel: per-method instanceIndex assigned');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
