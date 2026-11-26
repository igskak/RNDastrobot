const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const frontendRoot = path.join(__dirname, '../frontend');
const html = fs.readFileSync(path.join(frontendRoot, 'account-settings.html'), 'utf8');
const source = fs.readFileSync(path.join(frontendRoot, 'js/chart-import.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(frontendRoot, 'js/api.js'), 'utf8');

test('chart import presents both save destinations and plain UTC help', () => {
    assert.match(html, /name="chartImportPlacement" value="library"/);
    assert.match(html, /name="chartImportPlacement" value="profile"/);
    assert.match(source, /page\.accountSettings\.import\.utc\.copy/);
    assert.match(html, /accept="\.zbs,\.aaf,\.sfcht,\.as,\.txt"/);
    for (const source of ['zet', 'astro', 'solar', 'solarText', 'astrolog']) {
        assert.match(html, new RegExp(`page\\.accountSettings\\.import\\.file\\.${source}Instructions`));
    }
    assert.match(source, /issues\.map\(issueLabel\)/);
});

test('chart import renders imported values as text and exposes resumable API calls', () => {
    assert.doesNotMatch(source, /innerHTML\s*=/);
    assert.match(source, /textContent\s*=/);
    assert.match(source, /default_house_system/);
    for (const helper of [
        'previewChartImport',
        'getChartImport',
        'getChartImportItems',
        'confirmChartImport',
        'commitChartImportItem',
        'pauseChartImport',
    ]) {
        assert.match(apiSource, new RegExp(`\\b${helper}\\b`));
    }
});

test('resumed import preserves the profile and reports the first successful save', async () => {
    const dom = new JSDOM(html, {
        url: 'https://example.test/account-settings.html?import=batch-1',
        runScripts: 'outside-only',
    });
    const batch = {
        id: 'batch-1',
        original_filename: 'cards.zbs',
        source_format: 'zet',
        status: 'paused',
        total: 3,
        ready: 2,
        warnings: 0,
        errors: 0,
        configuration: {
            placement: 'profile',
            new_profile_name: 'Important events',
            tags: [],
            house_system: 'P',
        },
        items: [
            { id: 'pending', status: 'failed', selected: true, record: { title: 'Pending' }, issues: [] },
            { id: 'second', status: 'selected', selected: true, record: { title: 'Second' }, issues: [] },
            { id: 'skipped', status: 'skipped', selected: false, record: { title: 'Skipped' }, issues: [] },
        ],
    };
    const actions = [];
    dom.window.FrontendI18n = { t(key) { return key; } };
    dom.window.AstroAnalytics = { track(event, props) { actions.push([event, props.source_format]); } };
    dom.window.AstroAPI = {
        async requireAuth() {},
        async listPeople() { return []; },
        async listChartImports() { return []; },
        async getChartImport() { return batch; },
        async commitChartImportItem(_batchId, itemId) {
            actions.push(['commit', itemId]);
            return { status: 'imported' };
        },
    };
    dom.window.eval(source);
    if (dom.window.document.readyState === 'loading') {
        await new Promise((resolve) => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(Array.from(dom.window.ChartImport.getState().selected), ['pending', 'second']);
    assert.equal(dom.window.document.getElementById('chartImportProfileName').value, 'Important events');
    assert.equal(dom.window.document.querySelector('#chartImportRows input').disabled, true);
    assert.deepEqual(actions, []);
    dom.window.document.getElementById('chartImportStart').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(actions, [
        ['commit', 'pending'], ['chart_import_succeeded', 'zet'], ['commit', 'second'],
    ]);
    dom.window.close();
});
