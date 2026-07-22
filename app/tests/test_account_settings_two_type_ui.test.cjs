const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const html = read('frontend/account-settings.html');
const source = read('frontend/js/account-settings.js');
const css = read('frontend/css/account-settings.css');
const ru = JSON.parse(read('frontend/locales/ru.json'));

test('general settings expose only single and double chart columns', () => {
    assert.match(html, /tables\.columns\.single/);
    assert.match(html, /tables\.columns\.double/);
    assert.doesNotMatch(html, /id="(?:natal|biwheel|solar)(?:Orientation|AspectScope|Show)/);
    assert.match(source, /const VIEW_IDS = \['single', 'double'\]/);
    assert.match(source, /buildTechnicalChartDefaults/);
});

test('double chart has applying, speed, stationary, and aspect text controls', () => {
    for (const id of [
        'doubleShowApplyingSeparating',
        'doubleShowSpeed',
        'doubleShowStationary',
        'doubleShowAspectText',
    ]) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
});

test('solo billing navigation is hidden until account plan resolves', () => {
    assert.match(html, /data-settings-tab="billing"[^>]*hidden/);
    assert.match(html, /data-settings-panel="billing"[^>]*hidden/);
    assert.match(source, /billingTab\.hidden = isSoloPlan/);
    assert.match(source, /isSoloPlan && activeSettingsTab === 'billing'/);
});

test('color settings use four requested panels and no chart preview', () => {
    for (const panel of ['aspects', 'elements', 'planets', 'houses']) {
        assert.match(html, new RegExp(`data-visual-tab="${panel}"`));
        assert.match(html, new RegExp(`data-visual-panel="${panel}"`));
    }
    assert.doesNotMatch(html, /accountVisualWheelPreview|data-visual-panel="wheel"/);
    assert.doesNotMatch(source, /updateVisualPreview|PREVIEW_ASPECT_TYPES/);
    assert.doesNotMatch(css, /accent-color/);
});

test('Russian settings copy uses the approved terminology', () => {
    const settings = ru.page.accountSettings;
    assert.equal(settings.tables.columns.single, 'Одиночная карта');
    assert.equal(settings.tables.columns.double, 'Двойная карта');
    assert.equal(settings.tables.bodies.title, 'Элементы карты для всех экранов');
    assert.equal(settings.matrix.columns.display, 'Показать');
    assert.equal(settings.matrix.columns.aspecting, 'Аспектировать');
    assert.equal(settings.orbs.title, 'Профили орбисов');
    assert.equal(settings.dignities.title, 'Таблица управителей');
    assert.equal(settings.stationary.title, 'Настройки стационарности');
    assert.equal(settings.visual.title, 'Настройка цвета');
});
