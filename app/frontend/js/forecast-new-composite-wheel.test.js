/**
 * jsdom render harness for PrognosticRingsWheel (the shared natal/forecast/composite
 * wheel). Run from app/: node frontend/js/forecast-new-composite-wheel.test.js
 * (jsdom is an app devDependency.)
 *
 * Ship 3 renders composite charts through this engine via a thin adapter
 * (buildCompositeViewModel) — it does NOT modify the engine. These tests are the
 * permanent regression net D7 asked for: prove natal + a prognostic (forecast)
 * layer still render, and that composite-shaped viewModels render in both their
 * forms (midpoint = midpoint houses, Davison = real houses).
 *
 * jsdom has no SVG measurement, so getBBox/getBoundingClientRect are stubbed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;

// jsdom lacks SVG layout — stub the measurement APIs the wheel calls.
window.SVGElement.prototype.getBBox = function () { return { x: 0, y: 0, width: 10, height: 10 }; };
const rect = () => ({ x: 0, y: 0, width: 300, height: 300, top: 0, left: 0, right: 300, bottom: 300 });
window.SVGElement.prototype.getBoundingClientRect = rect;
window.Element.prototype.getBoundingClientRect = rect;

// `Symbols` is an ambient global (symbols.js) the engine reads with optional
// chaining; an undeclared identifier still throws, so provide an empty stub.
window.Symbols = {};

// The engine is an ES module (imports wheel-planet-annotations.js), so bundle it
// to an IIFE the same way the app build does, then eval it in the jsdom window.
const bundled = require('esbuild').buildSync({
    entryPoints: [path.join(__dirname, 'prognostic-rings-wheel.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
}).outputFiles[0].text;
// Ambient globals the engine reads as bare identifiers (defined elsewhere on the
// page in production). Declare them in the eval scope so the IIFE closes over them.
window.eval(`var Symbols = window.Symbols || {};\n${bundled}`);
const Wheel = window.PrognosticRingsWheel;
ok(typeof Wheel === 'function', 'engine: PrognosticRingsWheel loaded');

function newSvg() {
    const s = window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    window.document.body.appendChild(s);
    return s;
}
function bodyCount(svg) { return svg.querySelectorAll('.prognostic-body').length; }
function houseCount(svg) { return svg.querySelectorAll('.house-cusp-group').length; }

function natalLayer(bodies, houses, angles) {
    return {
        method: 'natal', label: 'N',
        bodies, aspectBodies: bodies, houses: houses || [], aspects: [],
        angles: angles || null, raw: {}, ringIndex: 0, style: { color: '#111' },
    };
}

const SUN_MOON = [{ name: 'Sun', longitude: 10 }, { name: 'Moon', longitude: 100 }];
const ANGLES = { ASC: { name: 'ASC', longitude: 0 }, MC: { name: 'MC', longitude: 270 } };
const HOUSES = Array.from({ length: 12 }, (_, i) => ({ number: i + 1, longitude: i * 30 }));

// --- natal baseline (regression) ---
(() => {
    const svg = newSvg();
    new Wheel(svg).render({ natalLayer: natalLayer(SUN_MOON, HOUSES, ANGLES), activePrognosticLayers: [] });
    ok(svg.querySelector('#prognostic-bodies') !== null, 'natal: bodies layer present');
    ok(bodyCount(svg) >= 2, 'natal: both bodies rendered');
    ok(houseCount(svg) >= 12, 'natal: 12 house cusps rendered');
})();

// --- forecast/biwheel (regression): natal + one prognostic layer ---
(() => {
    const svg = newSvg();
    const transit = {
        method: 'transit', label: 'T',
        bodies: [{ name: 'Mars', longitude: 200 }], aspectBodies: [{ name: 'Mars', longitude: 200 }],
        houses: [], aspects: [], raw: {}, ringIndex: 1, style: { color: '#a33' },
    };
    new Wheel(svg).render({ natalLayer: natalLayer(SUN_MOON, HOUSES, ANGLES), activePrognosticLayers: [transit] });
    ok(bodyCount(svg) >= 3, 'forecast: natal + transit bodies rendered (>=3)');
})();

// --- composite midpoint: planets + angles + midpoint houses ---
(() => {
    const svg = newSvg();
    new Wheel(svg).render({ natalLayer: natalLayer(SUN_MOON, HOUSES, ANGLES), activePrognosticLayers: [] });
    ok(bodyCount(svg) >= 2, 'composite-midpoint: bodies rendered');
    ok(houseCount(svg) >= 12, 'composite-midpoint: midpoint house cusps rendered');
})();

// --- composite Davison: planets + angles + houses ---
(() => {
    const svg = newSvg();
    new Wheel(svg).render({ natalLayer: natalLayer(SUN_MOON, HOUSES, ANGLES), activePrognosticLayers: [] });
    ok(bodyCount(svg) >= 2, 'composite-davison: bodies rendered');
    ok(houseCount(svg) >= 12, 'composite-davison: house cusps rendered');
})();

// --- empty/degenerate input must not throw ---
(() => {
    const svg = newSvg();
    let threw = false;
    try { new Wheel(svg).render({ natalLayer: natalLayer([], [], null), activePrognosticLayers: [] }); }
    catch (e) { threw = true; }
    ok(!threw, 'empty composite: renders without throwing');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
