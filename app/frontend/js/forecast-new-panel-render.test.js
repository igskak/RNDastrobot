/**
 * jsdom integration test for renderPanelsToDom against the real forecast-new.html.
 * Run from app/: node frontend/js/forecast-new-panel-render.test.js
 * (jsdom is an app devDependency.)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const L = require('./forecast-new-panel-layout.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

const html = fs.readFileSync(path.join(__dirname, '..', 'forecast-new.html'), 'utf8');
function freshDoc() { return new JSDOM(html).window.document; }
const t = (k) => k; // identity translate

function panelContent(doc, side) {
    const id = L.PANEL_SIDE_IDS[side];
    return doc.getElementById(id).querySelector('.panel-content');
}
function tabButtons(doc, side) {
    const id = L.PANEL_SIDE_IDS[side];
    // Exclude the overflow toggle (▸) which has no data-tab-id.
    return doc.getElementById(id).querySelectorAll('.panel-tabs .panel-tab[data-tab-id]');
}

// --- default multi layout ---
(() => {
    const doc = freshDoc();
    const layout = L.buildDefaultForecastNewLayout();
    const active = L.renderPanelsToDom({ document: doc, layout, mode: 'multi', activeTab: {}, translate: t });
    ok(tabButtons(doc, 'left').length === 9, 'multi: left has 9 tab buttons');
    ok(panelContent(doc, 'left').querySelectorAll('[data-tab-id]').length === 9, 'multi: left has 9 panes');
    ok(panelContent(doc, 'left').contains(doc.getElementById('natalPlanetsView')), 'multi: natalPlanetsView in left');
    ok(panelContent(doc, 'right').contains(doc.getElementById('progPlanetsView')), 'multi: progPlanetsView in right');
    const firstPane = panelContent(doc, 'left').querySelector('[data-tab-id]');
    ok(firstPane.classList.contains('active'), 'multi: first left pane active');
    ok(doc.getElementById('natalPlanetsView').classList.contains('active'), 'multi: natalPlanetsView active (visible in pane)');
    ok(active.multiLeft === layout.panels.multi.left[0].id, 'multi: activeTab.multiLeft set to first tab');
})();

// --- multi-block tab (3 natal blocks stacked in one left tab) ---
(() => {
    const doc = freshDoc();
    const layout = {
        schema_version: 1,
        panels: {
            multi: {
                left: [{ id: 't1', title: 'Мой набор', blocks: [
                    { source: 'natal', view: 'planets' },
                    { source: 'natal', view: 'configs' },
                    { source: 'natal', view: 'balances' },
                ] }],
                right: [{ id: 't2', blocks: [{ source: 'prog', view: 'grid' }] }],
            },
            single: { left: [], right: [] },
        },
    };
    L.renderPanelsToDom({ document: doc, layout: L.normalizeLayout(layout), mode: 'multi', activeTab: {}, translate: t });
    const pane = panelContent(doc, 'left').querySelector('[data-tab-id="t1"]');
    ok(!!pane, 'multiblock: custom tab pane present');
    ok(pane.querySelectorAll('.forecast-new-block').length === 3, 'multiblock: 3 stacked block wrappers');
    ok(pane.querySelectorAll('.forecast-new-block-header').length === 3, 'multiblock: 3 mini-headers');
    ok(pane.contains(doc.getElementById('natalPlanetsView')) &&
       pane.contains(doc.getElementById('natalConfigsView')) &&
       pane.contains(doc.getElementById('natalBalancesView')), 'multiblock: all 3 block divs inside the one pane');
    ok(tabButtons(doc, 'left')[0].textContent === 'Мой набор', 'multiblock: custom tab title used');
})();

// --- single mode: natal-only blocks distributed across both panels; prog* unused ---
(() => {
    const doc = freshDoc();
    const layout = L.buildDefaultForecastNewLayout();
    L.renderPanelsToDom({ document: doc, layout, mode: 'single', activeTab: {}, translate: t });
    ok(panelContent(doc, 'left').contains(doc.getElementById('natalPlanetsView')), 'single: natalPlanetsView in left');
    ok(panelContent(doc, 'right').contains(doc.getElementById('natalHousesView')), 'single: natalHousesView in right (natal data on right panel)');
    const store = doc.getElementById('forecastNewBlockStore');
    ok(store && store.contains(doc.getElementById('progPlanetsView')), 'single: prog* containers parked in store (unused)');
})();

// --- cross-panel move: a natal block placed on the RIGHT panel in multi mode ---
(() => {
    const doc = freshDoc();
    const layout = {
        schema_version: 1,
        panels: {
            multi: {
                left: [{ id: 'l1', blocks: [{ source: 'natal', view: 'planets' }] }],
                right: [{ id: 'r1', blocks: [{ source: 'natal', view: 'houses' }] }],
            },
            single: { left: [], right: [] },
        },
    };
    L.renderPanelsToDom({ document: doc, layout: L.normalizeLayout(layout), mode: 'multi', activeTab: {}, translate: t });
    ok(panelContent(doc, 'right').contains(doc.getElementById('natalHousesView')), 'crosspanel: natal Houses re-homed to right panel');
    ok(panelContent(doc, 'left').contains(doc.getElementById('natalPlanetsView')), 'crosspanel: natal Planets stays left');
})();

// --- re-render is stable (calling twice keeps divs, no duplication) ---
(() => {
    const doc = freshDoc();
    const layout = L.buildDefaultForecastNewLayout();
    L.renderPanelsToDom({ document: doc, layout, mode: 'multi', activeTab: {}, translate: t });
    L.renderPanelsToDom({ document: doc, layout, mode: 'multi', activeTab: {}, translate: t });
    ok(doc.querySelectorAll('#natalPlanetsView').length === 1, 'stable: no duplicate block divs after re-render');
    ok(panelContent(doc, 'left').querySelectorAll('[data-tab-id]').length === 9, 'stable: still 9 panes after re-render');
})();

// --- corner: assigned block re-homed into corner host, NOT in any panel pane ---
(() => {
    const doc = freshDoc();
    const layout = L.normalizeLayout({
        schema_version: 1,
        panels: {
            multi: {
                left: [{ id: 'l1', blocks: [{ source: 'natal', view: 'houses' }] }],
                right: [{ id: 'r1', blocks: [{ source: 'prog', view: 'planets' }] }],
                corners: { tl: { source: 'natal', view: 'planets' }, tr: null, bl: null, br: null },
            },
            single: { left: [], right: [] },
        },
    });
    L.renderPanelsToDom({ document: doc, layout, mode: 'multi', activeTab: {}, translate: t });
    const corner = doc.getElementById('forecastNewCornerTl');
    const planets = doc.getElementById('natalPlanetsView');
    ok(corner.contains(planets), 'corner: natalPlanetsView re-homed into top-left corner host');
    ok(!planelContains(doc, 'left', planets) && !planelContains(doc, 'right', planets), 'corner: planets NOT in any panel pane');
    ok(planets.classList.contains('is-compact'), 'corner: block carries .is-compact');
    ok(!corner.hidden && corner.classList.contains('forecast-new-corner-filled'), 'corner: filled corner visible');
    ok(corner.querySelector('[data-corner-remove="tl"]'), 'corner: direct remove control rendered');
    ok(planets.dataset.cornerView === 'planets', 'corner: compact view identity exposed');
    ok(doc.getElementById('forecastNewCornerTr').hidden, 'corner: empty corner hidden');
    ok(doc.querySelectorAll('#natalPlanetsView').length === 1, 'corner: still exactly one planets node');
})();

// helper: does a side panel's content contain node?
function planelContains(doc, side, node) {
    return panelContent(doc, side).contains(node);
}

// --- corner -> panel: moving block out of a corner re-homes it and hides corner ---
(() => {
    const doc = freshDoc();
    const withCorner = L.normalizeLayout({
        schema_version: 1,
        panels: {
            multi: { left: [], right: [], corners: { tl: { source: 'natal', view: 'planets' }, tr: null, bl: null, br: null } },
            single: { left: [], right: [] },
        },
    });
    L.renderPanelsToDom({ document: doc, layout: withCorner, mode: 'multi', activeTab: {}, translate: t });
    ok(doc.getElementById('forecastNewCornerTl').contains(doc.getElementById('natalPlanetsView')), 'cornermove: starts in corner');
    // now move it to the left panel
    const moved = L.normalizeLayout({
        schema_version: 1,
        panels: {
            multi: { left: [{ id: 'l1', blocks: [{ source: 'natal', view: 'planets' }] }], right: [], corners: { tl: null, tr: null, bl: null, br: null } },
            single: { left: [], right: [] },
        },
    });
    L.renderPanelsToDom({ document: doc, layout: moved, mode: 'multi', activeTab: {}, translate: t });
    ok(panelContent(doc, 'left').contains(doc.getElementById('natalPlanetsView')), 'cornermove: re-homed to left panel');
    ok(!doc.getElementById('natalPlanetsView').classList.contains('is-compact'), 'cornermove: .is-compact shed in panel');
    ok(doc.getElementById('forecastNewCornerTl').hidden, 'cornermove: emptied corner hidden again');
    ok(doc.querySelectorAll('#natalPlanetsView').length === 1, 'cornermove: still exactly one planets node');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
