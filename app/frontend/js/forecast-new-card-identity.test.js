/**
 * Unit tests for the pure card-identity module.
 * Run: node app/frontend/js/forecast-new-card-identity.test.js
 */
'use strict';

const ID = require('./forecast-new-card-identity.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }
function eq(actual, expected, msg) { ok(actual === expected, `${msg} (got ${JSON.stringify(actual)})`); }

// Helper stubs mirroring the real forecast-new.js semantics closely enough to
// exercise the module's fallback chains (not exact locale formatting).
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

// ── synastry title precedence ────────────────────────────────────────────────
(() => {
    const raw = { partner_chart: { birth_data: { first_name: 'Anna', last_name: 'Loaded', date: '1990-01-02', time: '10:00', place: 'Kyiv', timezone: '+02:00' } } };

    // config.chartTitle wins over everything.
    eq(ID.buildLayerCardIdentity({ method: 'synastry_partner', config: { chartTitle: 'Saved Title', manual: { name: 'Manual' } }, raw }, helpers).title,
        'Saved Title', 'synastry: config.chartTitle has top priority');

    // manual.name (per-instance) wins over loaded chart when no chartTitle.
    eq(ID.buildLayerCardIdentity({ method: 'synastry_partner', config: { manual: { name: 'Manual Name' } }, raw }, helpers).title,
        'Manual Name', 'synastry: per-instance config.manual.name beats loaded chart');

    // loaded partner_chart birth_data name when no config name.
    eq(ID.buildLayerCardIdentity({ method: 'synastry_partner', config: {}, raw }, helpers).title,
        'Anna Loaded', 'synastry: falls back to loaded partner_chart name');

    // nothing → method label.
    eq(ID.buildLayerCardIdentity({ method: 'synastry_partner', config: {}, raw: {} }, helpers).title,
        'Партнёр', 'synastry: empty everything → method label');

    // summary + datetimeLabel come from the loaded partner birth data.
    const full = ID.buildLayerCardIdentity({ method: 'synastry_partner', config: {}, raw }, helpers);
    eq(full.datetimeLabel, '1990-01-02 10:00', 'synastry: datetimeLabel from partner birth data');
    eq(full.summary, 'Kyiv · +02:00', 'synastry: summary carries partner place + tz only');
    ok(!full.summary.includes('1990-01-02') && !full.summary.includes('10:00'), 'synastry: summary excludes date/time for panel header');
})();

// ── REGRESSION: no global-scratch bleed across instances ─────────────────────
(() => {
    // Two synastry instances with different partners must produce different
    // titles purely from their own {config, raw}. The module has no global
    // access, so identity cannot leak from a "currently edited" partner.
    const a = ID.buildLayerCardIdentity({ method: 'synastry_partner', config: {}, raw: { partner_chart: { birth_data: { first_name: 'Alice' } } } }, helpers);
    const b = ID.buildLayerCardIdentity({ method: 'synastry_partner', config: {}, raw: { partner_chart: { birth_data: { first_name: 'Bob' } } } }, helpers);
    eq(a.title, 'Alice', 'regression: instance A title from its own raw');
    eq(b.title, 'Bob', 'regression: instance B title from its own raw');
    ok(a.title !== b.title, 'regression: two partner instances never share a name');
})();

// ── solar identity ───────────────────────────────────────────────────────────
(() => {
    const raw = { solar_info: { solar_datetime_local: '2026-07-10T14:30:00', year: 2026, timezone: '+02:00', location: { name: 'Porto' } } };
    const id = ID.buildLayerCardIdentity({ method: 'solar_return', config: {}, raw, solarYearFallback: 2025 }, helpers);
    eq(id.title, 'Соляр', 'solar: title is the method label');
    eq(id.datetimeLabel, '2026-07-10 14:30', 'solar: datetimeLabel from computed solar moment');
    eq(id.summary, 'Porto · +02:00', 'solar: summary is location + tz only for panel header');
    ok(!id.summary.includes('2026') && !id.summary.includes('14:30'), 'solar: summary excludes year/date/time for panel header');

    // config.chartTitle overrides label.
    const id2 = ID.buildLayerCardIdentity({ method: 'solar_return', config: { chartTitle: 'My Solar' }, raw: { solar_info: { solar_datetime_local: '2030-01-01T00:00:00', timezone: '+01:00', location: { name: 'Paris' } } }, solarYearFallback: 2030 }, helpers);
    eq(id2.title, 'My Solar', 'solar: config.chartTitle overrides label');
    eq(id2.summary, 'Paris · +01:00', 'solar: summary does not fall back to the year');
})();

// ── moment methods (transit): title only, live moment left to caller ─────────
(() => {
    const id = ID.buildLayerCardIdentity({ method: 'transit', config: { datetime: '2026-07-10T12:00' }, raw: {} }, helpers);
    eq(id.title, 'Транзит', 'transit: title is method label');
    eq(id.summary, '', 'transit: summary left empty for caller');
    eq(id.datetimeLabel, '2026-07-10 12:00', 'transit: datetimeLabel from config.datetime');
})();

// ── natal identity ───────────────────────────────────────────────────────────
(() => {
    const natal = ID.buildNatalCardIdentity({
        natalData: { birth_data: { first_name: 'Nat', last_name: 'Owner', place: 'Lviv', timezone: '+02:00' } },
        natalSelectedDateTime: '1990-09-11T08:15',
        natalTimezone: '+03:00',
        natalLocationName: 'Kharkiv',
        fallbackTitle: 'Натал',
    }, helpers);
    eq(natal.title, 'Nat Owner', 'natal: title from chartDisplayTitle');
    eq(natal.datetimeLabel, '1990-09-11 08:15', 'natal: datetimeLabel formatted');
    eq(natal.summary, 'Kharkiv · +03:00', 'natal: base summary is location-only (place · tz)');
    eq(natal.momentSummary, '1990-09-11 08:15 · Kharkiv · +03:00', 'natal: momentSummary prepends datetime');

    const roles = ID.computePanelRoles({ crossed: true, natalIdentity: natal, layerIdentity: { title: 'Layer', summary: 'Layer place' } });
    eq(roles.right.meta, 'Kharkiv · +03:00', 'swap: demoted natal panel meta excludes date/time');

    // empty natal → fallback title.
    eq(ID.buildNatalCardIdentity({ natalData: {}, fallbackTitle: 'Натал' }, helpers).title, 'Натал', 'natal: empty → fallback title');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
