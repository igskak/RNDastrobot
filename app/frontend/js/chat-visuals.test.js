/**
 * PR7c — table and chart rendering inside a chat message.
 * Run: node app/frontend/js/chat-visuals.test.js
 * (Repo has no JS test runner; this is a self-contained script.)
 *
 * The point of these assertions is the XSS boundary as much as the layout:
 * addMessage deliberately uses textContent, and rendering server data must not
 * become the hole that undoes it.
 */
'use strict';
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.fetch = async () => ({ ok: false });
global.URL = dom.window.URL;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

// chat.js is an ES module wired to a live page; lift just the rendering methods
// out of the source so they can run against jsdom without the widget's
// bootstrap. Keeps the test honest — it exercises the shipped code, not a copy.
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'chat.js'), 'utf8');

function extract(name) {
    // Methods may be declared `name(` or `async name(`.
    let start = source.indexOf(`\n    ${name}(`);
    if (start < 0) start = source.indexOf(`\n    async ${name}(`);
    if (start < 0) throw new Error(`method not found: ${name}`);
    let i = source.indexOf('{', start);
    let depth = 0;
    for (let j = i; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}') { depth--; if (depth === 0) { i = j; break; } }
    }
    return source.slice(start, i + 1);
}

const methods = ['appendVisuals', 'buildChart', 'drawBars', 'drawTimeline',
    'drawOrbLine', 'drawNetwork', 'buildTableElement', 'buildTableLauncher',
    'loadTablePage'];
const body = methods.map(extract).join('\n');
const ChatWidget = new Function(`
    const t = (k, p) => null;
    const withLocaleHeaders = (h) => h || {};
    const API_BASE_URL = '/api/v1';
    class ChatWidget {
        static svg(name, attrs) {
            const node = document.createElementNS('http://www.w3.org/2000/svg', name);
            for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
            return node;
        }
        ${body}
    }
    return ChatWidget;
`)();

const widget = new ChatWidget();

function events(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({
            id: `e${i}`, label: `Pluto Square Sun ${i}`,
            start: `2027-0${(i % 9) + 1}-01T00:00:00+00:00`,
            end: `2027-0${(i % 9) + 1}-20T00:00:00+00:00`,
            exact: [`2027-0${(i % 9) + 1}-10T00:00:00+00:00`],
        });
    }
    return out;
}

// --- charts render ---------------------------------------------------------

(function chartsRender() {
    const cases = [
        ['aspect_timeline', { type: 'aspect_timeline', series: events(4), alt: 'A' }],
        ['monthly_heatmap', { type: 'monthly_heatmap', series: [
            { bucket: '2027-01', value: 3 }, { bucket: '2027-02', value: 1 }], alt: 'B' }],
        ['orb_line', { type: 'orb_line', series: [
            { x: '2027-01-01T00:00:00+00:00', y: 0.1, label: 'a' },
            { x: '2027-02-01T00:00:00+00:00', y: 0.5, label: 'b' },
            { x: '2027-03-01T00:00:00+00:00', y: 0.2, label: 'c' }], alt: 'C' }],
        ['bar', { type: 'bar', series: [
            { bucket: 'Pluto', value: 7 }, { bucket: 'Uranus', value: 8 }], alt: 'D' }],
        ['network', { type: 'network', series: {
            nodes: [{ id: 't:Pluto', label: 'Pluto', kind: 'transit', degree: 2 },
                    { id: 'n:Sun', label: 'Sun', kind: 'natal', degree: 2 }],
            edges: [{ source: 't:Pluto', target: 'n:Sun', weight: 2 }] }, alt: 'E' }],
    ];
    for (const [name, chart] of cases) {
        const node = widget.buildChart(chart);
        ok(node && node.querySelector('svg'), `${name} produces an svg`);
        ok(node && node.querySelector('figcaption').textContent === chart.alt,
            `${name} shows its alt text as a caption`);
        ok(node.querySelector('svg title').textContent === chart.alt,
            `${name} carries an accessible svg title`);
    }
})();

(function timelineMarksExactPasses() {
    const node = widget.buildChart(
        { type: 'aspect_timeline', series: events(4), alt: 'x' });
    ok(node.querySelectorAll('circle.chart-exact').length === 4,
        'timeline marks every exact pass');
})();

(function degenerateChartsDoNotThrow() {
    ok(widget.buildChart({ type: 'bar', series: [], alt: '' }) === null,
        'an empty series renders nothing rather than an empty frame');
    ok(widget.buildChart({ type: 'orb_line', series: [{ x: 'nope', y: 1 }], alt: '' }) === null,
        'unparseable points render nothing rather than a broken axis');
})();

// --- the XSS boundary ------------------------------------------------------

(function labelsAreTextNotMarkup() {
    const hostile = '<img src=x onerror="alert(1)">';
    const node = widget.buildChart({
        type: 'bar', series: [{ bucket: hostile, value: 3 }, { bucket: 'ok', value: 1 }],
        alt: hostile,
    });
    ok(node.querySelectorAll('img').length === 0, 'a hostile chart label creates no element');
    ok(node.textContent.includes('<img'), 'the hostile label survives as literal text');
})();

(function tableCellsAreTextNotMarkup() {
    const data = {
        columns: [{ key: 'natal_body', label: 'Target', type: 'text' }],
        rows: [{ natal_body: '<script>alert(1)<\/script>' }],
        page: 1, page_count: 1, total_rows: 1, sort: 'enter', order: 'asc',
    };
    const el = widget.buildTableElement(data, { survey_id: 's' }, document.createElement('div'), {});
    ok(el.querySelectorAll('script').length === 0, 'a hostile cell creates no script element');
    ok(el.textContent.includes('<script>'), 'the hostile cell survives as literal text');
})();

// --- table behaviour -------------------------------------------------------

(function tableRendersHeadersAndRows() {
    const data = {
        columns: [{ key: 'transit_body', label: 'Transit', type: 'text' },
                  { key: 'min_orb', label: 'Min orb', type: 'number' }],
        rows: [{ transit_body: 'Pluto', min_orb: 0.1 },
               { transit_body: 'Uranus', min_orb: null }],
        page: 1, page_count: 2, total_rows: 30, sort: 'min_orb', order: 'asc',
    };
    const el = widget.buildTableElement(data, { survey_id: 's' }, document.createElement('div'), {});
    ok(el.querySelectorAll('thead th').length === 2, 'header cells render');
    ok(el.querySelectorAll('tbody tr').length === 2, 'body rows render');
    ok(el.querySelectorAll('td.num').length === 2, 'numeric columns are marked for alignment');
    ok(el.textContent.includes('—'), 'an empty cell shows a dash rather than "null"');
    ok(el.querySelector('th.sort-asc') !== null, 'the active sort direction is shown');
    ok(el.querySelector('.chat-table-nav') !== null, 'pagination appears when there is more than one page');
})();

(function singlePageHasNoPager() {
    const data = {
        columns: [{ key: 'transit_body', label: 'Transit', type: 'text' }],
        rows: [{ transit_body: 'Pluto' }],
        page: 1, page_count: 1, total_rows: 1, sort: 'enter', order: 'asc',
    };
    const el = widget.buildTableElement(data, { survey_id: 's' }, document.createElement('div'), {});
    ok(el.querySelector('.chat-table-nav') === null, 'no pager for a single page');
})();

(function resortResetsToFirstPage() {
    const state = { page: 7, sort: 'enter', order: 'asc', loaded: true };
    const data = {
        columns: [{ key: 'min_orb', label: 'Min orb', type: 'number' }],
        rows: [], page: 7, page_count: 9, total_rows: 200, sort: 'enter', order: 'asc',
    };
    widget.loadTablePage = async () => {};      // stub the fetch
    const el = widget.buildTableElement(data, { survey_id: 's' }, document.createElement('div'), state);
    el.querySelector('th.sortable').dispatchEvent(new dom.window.Event('click'));
    ok(state.page === 1, 'changing the sort returns to page 1');
    ok(state.sort === 'min_orb', 'the new sort column is applied');
})();

// --- what gets rendered at all ---------------------------------------------

(function onlySuccessfulResultsRender() {
    const container = document.createElement('div');
    widget.appendVisuals(container, [
        { name: 'create_astro_visualization', result: { status: 'error', error: 'too_few_rows_for_a_chart' } },
        { name: 'open_full_analysis_table', result: { status: 'error' } },
        { name: 'survey_transits', result: { status: 'ok', events: [] } },
    ]);
    ok(container.children.length === 0,
        'a declined chart and a failed table render nothing, and a survey is not a visual');
})();

(function tableLauncherOffersCsv() {
    const container = document.createElement('div');
    widget.appendVisuals(container, [{
        name: 'open_full_analysis_table',
        result: { status: 'ok', table_available: true, row_count: 22, survey_id: 'ts_abc',
                  default_sort: 'enter', columns: [] },
    }]);
    const csv = container.querySelector('.chat-table-csv');
    ok(csv !== null, 'a CSV link is offered');
    ok(csv.getAttribute('href').includes('ts_abc'), 'the CSV link points at the survey');
    ok(container.querySelector('.chat-table-body').hidden === true,
        'the table starts collapsed so it does not bury the answer');
})();

console.log(`chat-visuals: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
