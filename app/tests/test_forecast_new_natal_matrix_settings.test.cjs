const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('forecast-new map settings matrix controls natal chart rows', () => {
    const html = read('frontend/forecast-new.html');
    const js = read('frontend/js/forecast-new.js');

    assert.match(
        html,
        /id="forecastNewSettingsMatrixEditor"[^>]*data-matrix-scope="natal"/,
        'settings matrix editor should be explicitly scoped to natal rows',
    );
    assert.match(
        js,
        /forecastNewSettingsMatrixEditor,\s*fallbackScope: 'natal'/,
        'settings matrix editor should fall back to natal scope when markup is absent or stale',
    );
    assert.match(
        js,
        /getMatrixRowsForScope\(normalizedScope\)/,
        'matrix editor should render rows for the requested scope',
    );
    assert.match(
        js,
        /data-matrix-scope="\$\{escapeHtml\(normalizedScope\)\}"/,
        'rendered matrix inputs should carry their actual scope for shared sync handlers',
    );
});

test('forecast-new map settings label names natal chart planets and points', () => {
    const ru = JSON.parse(read('frontend/locales/ru.json'));
    const uk = JSON.parse(read('frontend/locales/uk.json'));
    const en = JSON.parse(read('frontend/locales/en.json'));

    assert.equal(ru.page.chart.settings.planetsAndPoints, 'Планеты и точки натальной карты');
    assert.equal(uk.page.chart.settings.planetsAndPoints, 'Планети та точки натальної карти');
    assert.equal(en.page.chart.settings.planetsAndPoints, 'Natal chart planets and points');
});
