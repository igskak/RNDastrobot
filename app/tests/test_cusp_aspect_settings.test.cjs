const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const preferences = require('../frontend/js/preferences.js');

test('chart settings expose aspecting-only controls for natal cusps', () => {
    const source = read('frontend/js/forecast-new.js');

    assert.match(source, /normalizedScope === 'natal'/);
    assert.match(source, /data-natal-cusp-aspecting=/);
    assert.match(source, /forecast-new-matrix-fixed-display[^>]*>—</);
    assert.doesNotMatch(source, /data-natal-cusp-display=/);
});

test('cusp aspect endpoints stay house-specific for wheel rendering', () => {
    const source = read('frontend/js/forecast-new.js');

    assert.match(source, /function aspectEndpointKey\(name\)/);
    assert.match(source, /\^Cusp\(\[1-9\]\|1\[0-2\]\)\$/);
    assert.match(source, /planet_2: aspectEndpointKey\(planet2\)/);
    assert.doesNotMatch(source, /planet_2: matrixBodyKey\(planet2\)/);
});

test('panel editor preserves now source when adding eclipse widgets in single mode', () => {
    const source = read('frontend/js/forecast-new.js');

    assert.match(source, /function editorBlockSource\(source, view, mode = currentWheelMode\(\)\)/);
    assert.match(source, /isNowView\?\.\(view\)\) return 'now'/);
    assert.match(source, /const source = editorBlockSource\(ds\.source, ds\.view, mode\)/);
    assert.doesNotMatch(source, /const blockKey = `\\$\\{mode === 'single' \\? 'natal'/);
});

test('orb settings add one compact cusp column with localized hover text', () => {
    const source = read('frontend/js/account-settings.js');
    const ru = JSON.parse(read('frontend/locales/ru.json'));

    assert.match(source, /CUSP_ORB_BODY/);
    assert.equal(ru.page.accountSettings.orbs.cuspsShort, 'Кусп');
    assert.equal(ru.page.accountSettings.orbs.cuspsTitle, 'Куспиды');
});

test('cusp matrix rows control specific cusp aspect endpoints through shared Cusp key', () => {
    assert.equal(preferences.normalizeMatrixBodyName('Cusp7'), 'Cusp');

    const rows = preferences.ensureMatrixRows({ Cusp7: { display: true, aspecting: false } });
    assert.equal(rows.Cusp.aspecting, false);

    const chartData = {
        aspects: [
            { planet_1: 'Sun', planet_2: 'Cusp7', aspect_type: 'Trine', orb: 1 },
            { planet_1: 'Sun', planet_2: 'Moon', aspect_type: 'Square', orb: 2 },
        ],
    };
    const filtered = preferences.filterChartDataByViewPreferences(chartData, {
        matrixRows: rows,
        aspectScope: 'major',
        enabledAspectTypes: ['Trine', 'Square'],
    });
    assert.deepEqual(filtered.aspects.map((aspect) => aspect.planet_2), ['Moon']);
});
