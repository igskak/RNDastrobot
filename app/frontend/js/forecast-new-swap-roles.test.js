/**
 * jsdom test: panel roles put the right CARD (name + meta) on the right PANEL,
 * against the real forecast-new.html header nodes.
 *
 * This is the regression guard for the user-reported bug: after swapping in
 * synastry, panel names were wrong and card data was mixed between panels.
 *
 * Run: node app/frontend/js/forecast-new-swap-roles.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ID = require('./forecast-new-card-identity.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }
function eq(a, e, msg) { ok(a === e, `${msg} (got ${JSON.stringify(a)})`); }

const html = fs.readFileSync(path.join(__dirname, '..', 'forecast-new.html'), 'utf8');
function freshDoc() { return new JSDOM(html).window.document; }
function text(doc, id) { return doc.getElementById(id).textContent; }

const LABELS = { solar_return: 'Соляр', synastry_partner: 'Партнёр', transit: 'Транзит' };
const helpers = {
    t: (k) => k,
    layerLabel: (m) => LABELS[m] || String(m || ''),
    formatChartDate: (d) => String(d || ''),
    formatChartDateTimeLabel: (dt) => String(dt || '').replace('T', ' '),
    buildPanelLocationMeta: (name, tz) => [name, tz].filter(Boolean).join(' · '),
    buildSolarMomentMeta: (info, { year }) => [year, info.solar_datetime_local].filter(Boolean).join(' | '),
    buildSolarPanelLocationMeta: (info) => [info?.location?.name, info?.timezone].filter(Boolean).join(' · '),
    chartDisplayTitle: (chart = {}, fallback = '') => {
        const b = chart.birth_data || {};
        return chart.display_title || chart.title || chart.person_display_name
            || [b.first_name, b.last_name].filter(Boolean).join(' ').trim()
            || fallback;
    },
};
const wrapBase = (name) => `База: ${name}`;

// Workspace owner (the natal card) and two DIFFERENT synastry partners.
const natalInput = {
    natalData: { birth_data: { first_name: 'Ирина', last_name: 'Клиент', place: 'Киев', timezone: '+02:00' } },
    natalSelectedDateTime: '1990-09-11T08:15',
    natalTimezone: '+02:00',
    natalLocationName: 'Киев',
    fallbackTitle: 'Натал',
};
const partnerA = { method: 'synastry_partner', config: {}, raw: { partner_chart: { birth_data: { first_name: 'Пётр', last_name: 'Партнёр', date: '1988-03-04', time: '11:20', place: 'Львов', timezone: '+02:00' } } } };
const partnerB = { method: 'synastry_partner', config: {}, raw: { partner_chart: { birth_data: { first_name: 'Ольга', last_name: 'Вторая', date: '1992-05-06', time: '07:45', place: 'Одесса', timezone: '+03:00' } } } };

const natalId = ID.buildNatalCardIdentity(natalInput, helpers);
const idA = ID.buildLayerCardIdentity(partnerA, helpers);
const idB = ID.buildLayerCardIdentity(partnerB, helpers);

function rolesFor({ crossed, layerIdentity, layerMeta }) {
    return ID.computePanelRoles({
        crossed, natalIdentity: natalId, layerIdentity, layerMeta, formatSwapBaseTitle: wrapBase,
    });
}

// ── (a) NOT swapped: client on the left, selected partner on the right ───────
(() => {
    const doc = freshDoc();
    const roles = rolesFor({ crossed: false, layerIdentity: idA, layerMeta: 'живой момент' });
    ID.applyPanelHeaderRoles(doc, roles);

    eq(text(doc, 'natalPanelTitle'), 'Ирина Клиент', 'no-swap: workspace owner names the LEFT panel');
    eq(text(doc, 'natalPanelMeta'), 'Киев · +02:00', 'no-swap: left meta is the natal place');
    eq(text(doc, 'prognosticPanelTitle'), 'Пётр Партнёр', 'no-swap: partner names the RIGHT panel');
    eq(text(doc, 'prognosticPanelMeta'), 'живой момент', 'no-swap: right meta is the layer live moment');
    eq(roles.left.kind, 'natal', 'no-swap: left role is natal');
    eq(roles.right.kind, 'layer', 'no-swap: right role is the layer');
})();

// ── (b) SWAPPED: partner promoted to the LEFT, client demoted to the RIGHT ───
(() => {
    const doc = freshDoc();
    const roles = rolesFor({ crossed: true, layerIdentity: idA });
    ID.applyPanelHeaderRoles(doc, roles);

    eq(text(doc, 'natalPanelTitle'), 'База: Пётр Партнёр', 'swap: promoted partner names the LEFT panel (base wrapper)');
    eq(text(doc, 'natalPanelMeta'), 'Львов · +02:00',
        'swap: left meta carries the PARTNER location/tz without date/time');
    eq(text(doc, 'prognosticPanelTitle'), 'Ирина Клиент', 'swap: demoted client names the RIGHT panel');
    eq(text(doc, 'prognosticPanelMeta'), 'Киев · +02:00',
        'swap: right meta carries the CLIENT location/tz without date/time');
    eq(roles.left.kind, 'layer', 'swap: left role is the promoted layer');
    eq(roles.right.kind, 'natal', 'swap: right role is the demoted natal');

    // The two cards' data never bleed into each other's panel.
    ok(!text(doc, 'natalPanelMeta').includes('Киев'), 'swap: client place absent from the promoted panel');
    ok(!text(doc, 'prognosticPanelMeta').includes('Львов'), 'swap: partner place absent from the demoted panel');
    ok(!text(doc, 'natalPanelMeta').includes('1988-03-04') && !text(doc, 'natalPanelMeta').includes('11:20'),
        'swap: promoted partner panel meta excludes partner date/time');
    ok(!text(doc, 'prognosticPanelMeta').includes('1990-09-11') && !text(doc, 'prognosticPanelMeta').includes('08:15'),
        'swap: demoted natal panel meta excludes natal date/time');
})();

// ── (c) after AUTO-EXIT (crossed=false again): names return to their panels ──
(() => {
    const doc = freshDoc();
    ID.applyPanelHeaderRoles(doc, rolesFor({ crossed: true, layerIdentity: idA }));
    // user clicks another layer tab → swap auto-exits → roles recomputed
    ID.applyPanelHeaderRoles(doc, rolesFor({ crossed: false, layerIdentity: idB, layerMeta: 'момент Б' }));

    eq(text(doc, 'natalPanelTitle'), 'Ирина Клиент', 'auto-exit: LEFT panel back to the workspace owner');
    eq(text(doc, 'prognosticPanelTitle'), 'Ольга Вторая', 'auto-exit: RIGHT panel shows the newly selected partner');
    ok(!text(doc, 'natalPanelTitle').includes('База:'), 'auto-exit: the swap base wrapper is gone');
})();

// ── (d) two partners never share a panel identity (per-instance, no scratch) ──
(() => {
    const swapA = rolesFor({ crossed: true, layerIdentity: idA });
    const swapB = rolesFor({ crossed: true, layerIdentity: idB });
    eq(swapA.left.title, 'База: Пётр Партнёр', 'swap A promotes partner A');
    eq(swapB.left.title, 'База: Ольга Вторая', 'swap B promotes partner B');
    ok(swapA.left.meta !== swapB.left.meta, 'two promoted partners never share meta');
    eq(swapA.right.title, swapB.right.title, 'the demoted natal is the same client in both');
})();

// ── (e) restored snapshot with swapBaseLayerId → swapped roles ───────────────
(() => {
    const doc = freshDoc();
    const snapshot = { swapBaseLayerId: 'synastry_partner-1', selectedRightLayerId: 'synastry_partner-1' };
    // Mirrors cmdRestoreWorkspace: swap restored, selection pinned to the invariant.
    const crossed = !!snapshot.swapBaseLayerId
        && snapshot.selectedRightLayerId === snapshot.swapBaseLayerId;
    ID.applyPanelHeaderRoles(doc, rolesFor({ crossed, layerIdentity: idA }));

    eq(text(doc, 'natalPanelTitle'), 'База: Пётр Партнёр', 'restore: swapped snapshot rebuilds the promoted LEFT panel');
    eq(text(doc, 'prognosticPanelTitle'), 'Ирина Клиент', 'restore: swapped snapshot rebuilds the demoted RIGHT panel');
})();

// ── (f) solar promoted: computed solar moment lands on the LEFT panel ────────
(() => {
    const doc = freshDoc();
    const solarId = ID.buildLayerCardIdentity({
        method: 'solar_return', config: { year: 2026 },
        raw: { solar_info: { solar_datetime_local: '2026-09-11T14:02:00', year: 2026, timezone: '+02:00', location: { name: 'Porto' } } },
    }, helpers);
    ID.applyPanelHeaderRoles(doc, rolesFor({ crossed: true, layerIdentity: solarId }));

    eq(text(doc, 'natalPanelTitle'), 'База: Соляр', 'swap(solar): promoted solar names the LEFT panel');
    eq(text(doc, 'natalPanelMeta'), 'Porto · +02:00',
        'swap(solar): left meta is the solar place/tz without date/time');
    ok(!text(doc, 'natalPanelMeta').includes('2026') && !text(doc, 'natalPanelMeta').includes('14:02'),
        'swap(solar): left meta excludes the server-computed solar moment');
    eq(text(doc, 'prognosticPanelTitle'), 'Ирина Клиент', 'swap(solar): client demoted to the RIGHT panel');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
